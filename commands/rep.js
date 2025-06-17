import { getMineflayerBot } from '../mineflayerBot.js';
import { EmbedBuilder } from 'discord.js';
import { fetchLands } from '../utils.js';
import { fetchOnlinePlayers, formatUuid } from '../utils.js';

const ENABLE_MINEFLAYER = process.env.ENABLE_MINEFLAYER === 'true';

export const data = {
    name: 'rep',
    description: 'Show reputations of online players'
};

export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
        // Fetch lands and online players
        const lands = await fetchLands();
        const onlinePlayers = await fetchOnlinePlayers();

        if (onlinePlayers.length === 0) {
            await interaction.editReply('There are no players online currently.');
            return;
        }

        // Create a map for player land information
        const playerMap = new Map();
        for (const land of lands) {
            for (const playerName of land.playersList) {
                const key = playerName.toLowerCase();
                playerMap.set(key, {
                    landName: land.name,
                    coordinates: `X: ${land.x || 'Unknown'}, Z: ${land.z || 'Unknown'}`
                });
            }
        }

        const reputations = [];
        const fetchPromises = onlinePlayers.map(async (player) => {
            const uuid = player.uuid; // Directly use UUID from fetchOnlinePlayers
            if (uuid) {
                try {
                    const response = await fetch(`https://api.santoria.net/player/${formatUuid(uuid)}`);
                    if (response.ok) {
                        const data = await response.json();
                        if (data && data.reputation !== undefined) {
                            reputations.push({
                                name: player.name, // Keep player name for display
                                points: Math.ceil(data.reputation), // Round up reputation
                                title: 'N/A', // Placeholder
                                hourlyGain: 0 // Placeholder
                            });
                        }
                    } else {
                        console.error(`Error fetching player data for ${player.name} (${uuid}): ${response.status}`);
                    }
                } catch (error) {
                    console.error(`Error fetching player data for ${player.name} (${uuid}):`, error);
                }
            } else {
                console.warn(`No UUID available for player: ${player.name}`);
            }
        });

        await Promise.all(fetchPromises);

        // Filter reputations <= 30 and sort
        const lowReputationPlayers = reputations
            .filter(rep => rep.points <= 30)
            .sort((a, b) => a.points - b.points); // Sort by lowest reputation first

        if (lowReputationPlayers.length === 0) {
            await interaction.editReply(`No players with reputation 30 or lower are currently online.`);
            return;
        }

        // Create embed
        const embed = new EmbedBuilder()
            .setColor(0xFF5555)
            .setTitle('⚠️ Low Reputation Players')
            .setDescription(`*Data fetched from Santoria API at ${new Date().toLocaleTimeString()}*`)
            .setTimestamp();

        // Add fields for each player
        for (const rep of lowReputationPlayers) {
            const playerInfo = playerMap.get(rep.name.toLowerCase());
            const land = playerInfo ? playerInfo.landName : 'Unknown';
            const coordinates = playerInfo ? playerInfo.coordinates : 'Unknown';
            const skull = rep.points <= 0 ? '💀 ' : '';

            embed.addFields({
                name: `${skull}${rep.name} (${rep.points})`, // Display reputation (already rounded)
                value: `**Status:** 🟢 Online\n**Land:** ${land}\n**Coordinates:** ${coordinates}`, // Removed title and hourlyGain as they are not in the new API
                inline: false
            });
        }

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error executing rep command:', error);
        await interaction.editReply('An error occurred while fetching reputation data.');
    }
}

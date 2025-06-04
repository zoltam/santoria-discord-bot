import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getMineflayerBot } from '../mineflayerBot.js';
import { fetchLands } from '../utils.js';
import { fetchOnlinePlayers } from '../utils.js';

const ENABLE_MINEFLAYER = process.env.ENABLE_MINEFLAYER === 'true';

export const data = new SlashCommandBuilder()
    .setName('rep')
    .setDescription('Show reputations of online players')
    .setDMPermission(true);

export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    if (!ENABLE_MINEFLAYER) {
        await interaction.editReply('Mineflayer features are currently disabled, so reputation data cannot be fetched.');
        return;
    }

    try {
        const bot = getMineflayerBot();
        
        // Get reputations from cache (bot now updates periodically)
        const result = await bot.getReputations();
        
        if (!result.success) {
            await interaction.editReply(`Failed to get reputation data: ${result.message}`);
            return;
        }
        
        // Convert Map to array and filter reputations <= 30
        const reputations = Array.from(result.data.values())
            .filter(rep => rep.points <= 30)
            .sort((a, b) => a.points - b.points); // Sort by lowest reputation first
            
        if (reputations.length === 0) {
            await interaction.editReply(`No players with reputation 30 or lower are currently online. Last updated at ${new Date(result.lastUpdate).toLocaleTimeString()}`);
            return;
        }
        
        // Fetch lands and online players
        const lands = await fetchLands();
        const onlinePlayers = await fetchOnlinePlayers();
        
        // Create set of online player names for easy lookup
        const onlinePlayerNames = new Set(onlinePlayers.map(player => player.name.toLowerCase()));

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
        
        // Create embed
        const embed = new EmbedBuilder()
            .setColor(0xFF5555)
            .setTitle('⚠️ Low Reputation Players')
            .setDescription(`*Data updated at ${new Date(result.lastUpdate).toLocaleTimeString()}*`)
            .setTimestamp();
            
        // Add fields for each player
        for (const rep of reputations) {
            const isOnline = onlinePlayerNames.has(rep.name.toLowerCase());
            const status = isOnline ? '🟢 Online' : '⚫ Offline';
            const skull = rep.points <= 0 ? '💀 ' : '';
            const playerInfo = playerMap.get(rep.name.toLowerCase());
            const land = playerInfo ? playerInfo.landName : 'Unknown';
            const coordinates = playerInfo ? playerInfo.coordinates : 'Unknown';
            
            let value = `**${rep.title}** | +${rep.hourlyGain}/hr\n**Status:** ${status}\n**Land:** ${land}\n**Coordinates:** ${coordinates}`;
            if (rep.hoverInfo) {
                value += `\n**Hover Info:**\n\`\`\`\n${rep.hoverInfo}\n\`\`\``;
            }
            
            embed.addFields({
                name: `${skull}${rep.name} (${rep.points})`,
                value: value,
                inline: false
            });
        }
        
        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error executing rep command:', error);
        await interaction.editReply('An error occurred while fetching reputation data.');
    }
}

import { getTrackedPlayers } from '../trackers.js';
import { fetchLands, fetchOnlinePlayers, formatUuid } from '../utils.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import fetch from 'node-fetch';

function getWorldName(world) {
    return world === 'minecraft_overworld' ? 'Atlas' :
           world === 'minecraft_world_spawn' ? 'Aether' : 'Unknown';
}

export const data = {
    name: 'tracked',
    description: 'List all players you are currently tracking.'
};

export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.user.id;
    const trackedPlayers = getTrackedPlayers(); // Map<uuid, { username: string, lastStatus: { online: boolean, world: string }, trackedBy: Set<string> }>
    const userTrackedData = []; // Array of { uuid: string, username: string, lastStatus: { online: boolean, world: string } }

    for (const [uuid, data] of trackedPlayers.entries()) {
        if (data.trackedBy.has(userId) && data.username) {
            userTrackedData.push({ uuid: uuid, username: data.username, lastStatus: data.lastStatus });
        }
    }

    if (userTrackedData.length === 0) {
        await interaction.editReply({
            content: 'You are not currently tracking any players.',
            ephemeral: true
        });
        return;
    }

    try {
        const onlinePlayers = await fetchOnlinePlayers();
        const lands = await fetchLands();
        
        // Create a map of online players keyed by UUID for efficient lookup
        const onlinePlayerMap = new Map(onlinePlayers.map(p => [p.uuid, p]));

        const playerLandMap = new Map();
        for (const land of lands) {
            for (const playerName of land.playersList) {
                playerLandMap.set(playerName.toLowerCase(), { // Still keyed by name from fetchLands
                    landName: land.name,
                    nationName: land.nationName,
                    coordinates: `X: ${land.x || 'Unknown'}, Z: ${land.z || 'Unknown'}`
                });
            }
        }

        const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle('Currently Tracked Players')
            .setDescription('Here is a list of players you are tracking:\n\nTo see more details about a land, use the `/land <land name>` command.')
            .setTimestamp();

        const components = [];

        // Fetch reputations for all tracked players concurrently
        const reputationPromises = userTrackedData.map(async (playerData) => {
            try {
                const response = await fetch(`https://api.santoria.net/player/${formatUuid(playerData.uuid)}`);
                if (response.ok) {
                    const data = await response.json();
                    return { uuid: playerData.uuid, reputation: Math.ceil(data.reputation) };
                } else {
                    console.error(`Error fetching reputation for ${playerData.username} (${playerData.uuid}): ${response.status}`);
                    return { uuid: playerData.uuid, reputation: 'N/A' };
                }
            } catch (error) {
                console.error(`Error fetching reputation for ${playerData.username} (${playerData.uuid}):`, error);
                return { uuid: playerData.uuid, reputation: 'N/A' };
            }
        });

        const reputations = await Promise.all(reputationPromises);
        const reputationsMap = new Map(reputations.map(r => [r.uuid, r.reputation]));

        for (const playerData of userTrackedData) {
            const username = playerData.username;
            const uuid = playerData.uuid;
            const currentOnlineData = onlinePlayerMap.get(uuid); // Look up by UUID
            const isOnline = !!currentOnlineData;
            const statusEmoji = isOnline ? '🟢' : '🔴';
            const world = isOnline && currentOnlineData?.world ? getWorldName(currentOnlineData.world) : 'N/A';
            
            const reputationPoints = reputationsMap.get(uuid);
            const reputationField = `**Reputation:** ⭐ ${reputationPoints !== undefined ? reputationPoints : 'N/A'}\n`;

            const playerLandInfo = playerLandMap.get(username.toLowerCase()); // Still keyed by name
            const landName = playerLandInfo ? playerLandInfo.landName : 'N/A';
            const nationName = playerLandInfo && playerLandInfo.nationName !== 'None' ? playerLandInfo.nationName : 'N/A';
            const coordinates = playerLandInfo ? playerLandInfo.coordinates : 'N/A';

            embed.addFields({
                name: `${statusEmoji} ${username}`,
                value: `**World:** 🌍 ${world}\n${reputationField}**Land:** 🏡 ${landName}\n**Nation:** 👑 ${nationName}`,
                inline: true
            });
        }

        await interaction.editReply({
            embeds: [embed],
            components: components,
            ephemeral: true
        });

    } catch (error) {
        console.error('Error executing tracked command:', error);
        await interaction.editReply('An error occurred while fetching tracked player data.');
    }
}

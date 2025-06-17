import { getTrackedPlayers } from '../trackers.js';
import { fetchLands, fetchOnlinePlayers, formatUuid } from '../utils.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import fetch from 'node-fetch';

function getWorldName(world) {
    return world === 'minecraft_overworld' ? 'Atlas' :
           world === 'minecraft_world_spawn' ? 'Aether' : 'Unknown';
}

function getReputationTitleAndColor(reputation) {
    let title = 'N/A';
    let color = '⚪'; // Default white circle

    if (reputation === 100) {
        title = 'AMAZING';
        color = '🟢';
    } else if (reputation >= 90 && reputation <= 99) {
        title = 'Very good';
        color = '🟢';
    } else if (reputation >= 80 && reputation <= 89) {
        title = 'Great';
        color = '🟢';
    } else if (reputation >= 70 && reputation <= 79) {
        title = 'Good';
        color = '🟢';
    } else if (reputation >= 60 && reputation <= 69) {
        title = 'Not bad';
        color = '🟡';
    } else if (reputation >= 50 && reputation <= 59) {
        title = 'Neutral';
        color = '🟡';
    } else if (reputation >= 40 && reputation <= 49) {
        title = 'Not good';
        color = '🟠';
    } else if (reputation >= 30 && reputation <= 39) {
        title = 'Bad';
        color = '🔴';
    } else if (reputation >= 20 && reputation <= 29) {
        title = 'Awful';
        color = '🔴';
    } else if (reputation >= 10 && reputation <= 19) {
        title = 'Horrible';
        color = '🔴';
    } else if (reputation >= 1 && reputation <= 9) {
        title = 'Shocking';
        color = '🔴';
    } else if (reputation === 0) {
        title = 'Shocking';
        color = '🔴';
    }

    return { title, color };
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

        const allPlayerEmbeds = [];
        const components = []; // Keep components if they are used elsewhere, though not in this specific embed.

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
            const currentOnlineData = onlinePlayerMap.get(uuid);
            const isOnline = !!currentOnlineData;
            const statusEmoji = isOnline ? '🟢' : '🔴';
            const world = currentOnlineData?.world ? getWorldName(currentOnlineData.world) : 'N/A';
            
            const reputationPoints = reputationsMap.get(uuid);
            const { title, color } = getReputationTitleAndColor(reputationPoints);

            const playerLandInfo = playerLandMap.get(username.toLowerCase());
            const landName = playerLandInfo ? playerLandInfo.landName : 'N/A';
            const nationName = playerLandInfo && playerLandInfo.nationName !== 'None' ? playerLandInfo.nationName : 'N/A';

            const playerEmbed = new EmbedBuilder()
                .setColor(0x0099ff)
                .setAuthor({ name: username, iconURL: `https://mc-heads.net/avatar/${username}/32` })
                .addFields(
                    { name: 'Status', value: `${statusEmoji} ${isOnline ? 'Online' : 'Offline'}`, inline: false },
                    { name: '🌍 World', value: world, inline: false },
                    { name: '🏅 Reputation', value: `${color} ${title} (${reputationPoints !== undefined ? reputationPoints : 'N/A'} points)`, inline: false },
                    { name: '🏘️ Land', value: landName, inline: false },
                    { name: '👑 Nation', value: nationName, inline: false }
                );
            
            allPlayerEmbeds.push(playerEmbed);
        }

        // Discord allows up to 10 embeds per message. If more, send in chunks or simplify.
        // For now, assuming less than or equal to 10.
        await interaction.editReply({
            content: 'Here are the players you are tracking:', // Add a general message
            embeds: allPlayerEmbeds,
            components: components, // Keep components if needed
            ephemeral: true
        });

    } catch (error) {
        console.error('Error executing tracked command:', error);
        await interaction.editReply('An error occurred while fetching tracked player data.');
    }
}

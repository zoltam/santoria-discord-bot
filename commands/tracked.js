import { getTrackedPlayers } from '../trackers.js';
import { getMineflayerBot } from '../mineflayerBot.js';
import { fetchLands, fetchOnlinePlayers } from '../utils.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

function getWorldName(world) {
    return world === 'minecraft_overworld' ? 'Atlas' :
           world === 'minecraft_world_spawn' ? 'Aether' : 'Unknown';
}

const ENABLE_MINEFLAYER = process.env.ENABLE_MINEFLAYER === 'true';

export const data = {
    name: 'tracked',
    description: 'List all players you are currently tracking.'
};

export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.user.id;
    const trackedPlayers = getTrackedPlayers();
    const userTrackedData = [];

    for (const [username, data] of trackedPlayers.entries()) {
        if (data.trackedBy.has(userId) && data.originalUsername) {
            userTrackedData.push({ username: data.originalUsername, lastStatus: data.lastStatus });
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
        
        let reputationsMap = new Map();
        if (ENABLE_MINEFLAYER) {
            const bot = getMineflayerBot();
            const reputationsResult = await bot.getReputations();
            reputationsMap = new Map(reputationsResult.success ? reputationsResult.data : []);
        }

        const onlinePlayerNames = new Set(onlinePlayers.map(player => player.name.toLowerCase()));

        const playerLandMap = new Map();
        for (const land of lands) {
            for (const playerName of land.playersList) {
                playerLandMap.set(playerName.toLowerCase(), {
                    landName: land.name,
                    nationName: land.nationName,
                    coordinates: `X: ${land.x || 'Unknown'}, Z: ${land.z || 'Unknown'}`
                });
            }
        }

        const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle('Currently Tracked Players')
            .setDescription('Here is a list of players you are tracking:')
            .setTimestamp();

        const components = [];
        const landButtons = new ActionRowBuilder();
        let buttonCount = 0;

        for (const playerData of userTrackedData) {
            const username = playerData.username;
            const isOnline = onlinePlayerNames.has(username.toLowerCase());
            const statusEmoji = isOnline ? '🟢' : '🔴';
            const world = isOnline && playerData.lastStatus.world ? getWorldName(playerData.lastStatus.world) : 'N/A';
            
            let reputationField = '';
            if (ENABLE_MINEFLAYER) {
                const reputation = reputationsMap.get(username.toLowerCase());
                const repPoints = reputation ? reputation.points : 'N/A';
                reputationField = `**Reputation:** ⭐ ${repPoints}\n`;
            }

            const playerLandInfo = playerLandMap.get(username.toLowerCase());
            const landName = playerLandInfo ? playerLandInfo.landName : 'N/A';
            const nationName = playerLandInfo && playerLandInfo.nationName !== 'None' ? playerLandInfo.nationName : 'N/A';
            const coordinates = playerLandInfo ? playerLandInfo.coordinates : 'N/A';

            embed.addFields({
                name: `${statusEmoji} ${username}`,
                value: `**World:** 🌍 ${world}\n${reputationField}**Land:** 🏡 ${landName}\n**Nation:** 👑 ${nationName}`,
                inline: true
            });

            if (landName !== 'N/A' && buttonCount < 5) { // Discord allows max 5 buttons per row
                landButtons.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`show_land_info_${landName.replace(/\s/g, '_')}_${username.replace(/\s/g, '_')}`) // Custom ID for button
                        .setLabel(`Land: ${landName}`)
                        .setStyle(ButtonStyle.Secondary)
                );
                buttonCount++;
            }
        }

        if (landButtons.components.length > 0) {
            components.push(landButtons);
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

import { EmbedBuilder } from 'discord.js';
import { fetchOnlinePlayers, formatUuid, fetchPlayerUuid, fetchLands, getWorldName, getReputationTitleAndColor } from '../utils.js';

export const data = {
    name: 'player',
    description: 'Shows detailed data for a player.',
    options: [
        {
            name: 'playername',
            type: 3, // STRING type
            description: 'The name of the player (online or offline).',
            required: true,
            autocomplete: true
        }
    ]
};

export async function autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const onlinePlayers = await fetchOnlinePlayers();
    const choices = onlinePlayers.map(player => ({ name: player.name, value: player.name }));

    const filtered = choices.filter(choice => choice.name.toLowerCase().startsWith(focusedValue.toLowerCase()));
    await interaction.respond(filtered.slice(0, 25)); // Discord limits to 25 choices
}

export async function execute(interaction) {
    await interaction.deferReply();

    const playerNameOrUuid = interaction.options.getString('playername');
    let playerUuid = playerNameOrUuid; // Assume it's a UUID initially

    // Check if it's a UUID format, if not, try to resolve it
    if (!playerNameOrUuid.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        // It's likely a player name, try to resolve UUID
        const resolvedUuid = await fetchPlayerUuid(playerNameOrUuid); // This function needs to be implemented in utils.js
        if (resolvedUuid) {
            playerUuid = resolvedUuid;
        } else {
            await interaction.editReply(`Could not find a player with the name "${playerNameOrUuid}". Please check the spelling or provide a valid UUID.`);
            return;
        }
    }

    try {
        const lands = await fetchLands();
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

        const response = await fetch(`https://api.santoria.net/player/${formatUuid(playerUuid)}`);

        if (!response.ok) {
            let errorMessage = `Error fetching player data for "${playerNameOrUuid}".`;
            if (response.status === 400) {
                errorMessage = 'Bad Request: Likely provided an invalid/malformed UUID.';
            } else if (response.status === 404) {
                errorMessage = 'Not Found: Provided UUID does not have data.';
            } else if (response.status === 503) {
                errorMessage = 'Service Unavailable: Database is likely not connected yet.';
            }
            await interaction.editReply(errorMessage);
            return;
        }

        const data = await response.json();

        const onlinePlayers = await fetchOnlinePlayers();
        const onlinePlayerMap = new Map(onlinePlayers.map(p => [p.uuid, p]));
        const currentOnlineData = onlinePlayerMap.get(formatUuid(data._id)); // Ensure UUID format matches
        const isOnline = !!currentOnlineData;
        const statusEmoji = isOnline ? '🟢' : '🔴';
        const world = currentOnlineData?.world ? getWorldName(currentOnlineData.world) : 'N/A';

        const reputationPoints = Math.ceil(data.reputation);
        const { title, color } = getReputationTitleAndColor(reputationPoints);

        let isHoldingRepMedallion = false;
        if (data.reputationModifiers && Array.isArray(data.reputationModifiers)) {
            for (const modifier of data.reputationModifiers) {
                if (modifier.type === 'USE_REP_MEDALLION') {
                    const timeDifference = modifier.startingTime - modifier.timeRemaining;
                    if (timeDifference > 30) {
                        isHoldingRepMedallion = true;
                        break;
                    }
                }
            }
        }

        const playerLandInfo = playerLandMap.get(data.name.toLowerCase());
        const landName = playerLandInfo ? playerLandInfo.landName : 'N/A';
        const nationName = playerLandInfo && playerLandInfo.nationName !== 'None' ? playerLandInfo.nationName : 'N/A';

        const authorIconUrl = `https://minotar.net/avatar/${data._id}/100.png`;
        const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setAuthor({ name: data.name, iconURL: authorIconUrl })
            .addFields(
                { name: 'Status', value: `${statusEmoji} ${isOnline ? 'Online' : 'Offline'}`, inline: true },
                { name: '🌍 World', value: world, inline: true },
                { name: 'Reputation', value: `${color} ${title} (${reputationPoints} points)`, inline: true },
                { name: 'Sanity', value: `${data.sanity !== undefined ? data.sanity.toFixed(2) : 'N/A'}`, inline: true },
                { name: 'Land', value: `🏡 ${landName}`, inline: true },
                { name: 'Nation', value: `👑 ${nationName}`, inline: true },
                ...(isHoldingRepMedallion ? [{ name: 'Rep Medallion', value: '✅ Holding', inline: true }] : [])
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error executing player command:', error);
        await interaction.editReply('An error occurred while fetching player data.');
    }
}

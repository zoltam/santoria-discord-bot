import { fetchOnlinePlayers, fetchLands, formatUuid } from '../utils.js';
import { getMineflayerBot } from '../mineflayerBot.js';

const ENABLE_MINEFLAYER = process.env.ENABLE_MINEFLAYER === 'true';

export const data = {
    name: 'players',
    description: 'List online players'
};

export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    try {
        const onlinePlayers = await fetchOnlinePlayers();
        const lands = await fetchLands();
        
        const playerMap = new Map();
        for (const land of lands) {
            for (const playerName of land.playersList) {
                const key = playerName.toLowerCase();
                playerMap.set(key, {
                    landName: land.name,
                    nationName: land.nationName
                });
            }
        }

        const reputationMap = new Map();
        const fetchPromises = onlinePlayers.map(async (player) => {
            const uuid = player.uuid; // Directly use UUID from fetchOnlinePlayers
            if (uuid) {
                try {
                    const response = await fetch(`https://api.santoria.net/player/${formatUuid(uuid)}`);
                    if (response.ok) {
                        const data = await response.json();
                        if (data && data.reputation !== undefined) {
                            reputationMap.set(player.name.toLowerCase(), Math.ceil(data.reputation)); // Round up reputation
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

        const formattedPlayers = onlinePlayers.map(player => {
            const info = playerMap.get(player.name.toLowerCase());
            const reputation = reputationMap.get(player.name.toLowerCase());

            let repPart = '';
            let warningSymbol = '';
            if (reputation !== undefined) {
                repPart = ` [${reputation}]`; // Display reputation (already rounded)
                warningSymbol = reputation <= 20 ? ' ⚠️' : '';
            }

            const landPart = info ? ` (${info.landName})` : '';
            const nationPart = info && info.nationName !== 'None' ? ` (${info.nationName})` : '';
            const worldPart = player.world === 'minecraft_world_spawn' ? ' (aether)' : '';

            return `${player.name}${repPart}${warningSymbol}${landPart}${nationPart}${worldPart}`;
        });

        if (formattedPlayers.length === 0) {
            await interaction.editReply({ content: 'There are no players online currently.' });
            return;
        }

        const embeds = [];
        let currentChunk = [];
        let currentLength = 0;

        for (const playerEntry of formattedPlayers) {
            const entryLength = playerEntry.length + 2;
            if (currentLength + entryLength > 4096) {
                embeds.push({
                    color: 0x0099ff,
                    title: embeds.length === 0 ? `Online Players (${formattedPlayers.length})` : '',
                    description: currentChunk.join(', '),
                    footer: {
                        text: `Player information from Atlas Map | Rep data from Santoria API`
                    }
                });
                currentChunk = [];
                currentLength = 0;
            }
            currentChunk.push(playerEntry);
            currentLength += entryLength;
        }

        if (currentChunk.length > 0) {
            embeds.push({
                color: 0x0099ff,
                title: embeds.length === 0 ? `Online Players (${formattedPlayers.length})` : '',
                description: currentChunk.join(', '),
                footer: {
                    text: `Player information from Atlas Map | Rep data from Santoria API`
                }
            });
        }

        await interaction.editReply({ embeds: embeds.slice(0, 10) });
    } catch (error) {
        console.error('Error executing players command:', error);
        await interaction.editReply('Error fetching players');
    }
}

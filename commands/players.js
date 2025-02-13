import { fetchOnlinePlayers, fetchLands } from '../utils.js';

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

                const formattedPlayers = onlinePlayers.map(player => {
                    const info = playerMap.get(player.name.toLowerCase());
                    const landPart = info ? ` (${info.landName})` : '';
                    const nationPart = info && info.nationName !== 'None' ? ` (${info.nationName})` : '';
                    const worldPart = player.world === 'minecraft_world_spawn' ? ' (aether)' : '';
                    return `${player.name}${landPart}${nationPart}${worldPart}`;
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
                            footer: embeds.length === 0 ? { text: 'Player information from Atlas Map' } : undefined
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
                        footer: embeds.length === 0 ? { text: 'Player information from Atlas Map' } : undefined
                    });
                }

                await interaction.editReply({ embeds: embeds.slice(0, 10) });
    } catch (error) {
        await interaction.editReply('Error fetching players');
    }
}
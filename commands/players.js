import { fetchOnlinePlayers, fetchLands } from '../utils.js';
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
        
        let repData = { success: false, data: new Map(), lastUpdate: Date.now() };
        if (ENABLE_MINEFLAYER) {
            const reputationBot = getMineflayerBot();
            repData = await reputationBot.getReputations();
        }

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
                    
                    let repPart = '';
                    let warningSymbol = '';
                    if (ENABLE_MINEFLAYER && repData.success) {
                        const rep = repData.data.get(player.name.toLowerCase());
                        repPart = rep ? ` [${rep.points}]` : '';
                        warningSymbol = rep && rep.points <= 20 ? ' ⚠️' : '';
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
                            footer: embeds.length === 0 && ENABLE_MINEFLAYER && repData.success ? { 
                                text: `Player information from Atlas Map | Rep data ${new Date(repData.lastUpdate).toLocaleTimeString()}` 
                            } : undefined
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
                        footer: embeds.length === 0 && ENABLE_MINEFLAYER && repData.success ? { 
                            text: `Player information from Atlas Map | Rep data ${new Date(repData.lastUpdate).toLocaleTimeString()}` 
                        } : undefined
                    });
                }

                await interaction.editReply({ embeds: embeds.slice(0, 10) });
    } catch (error) {
        console.error('Error executing players command:', error);
        await interaction.editReply('Error fetching players');
    }
}

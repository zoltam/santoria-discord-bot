import { fetchLands } from '../utils.js';
import { fetchOnlinePlayers } from '../utils.js';

export const data = {
    name: 'land',
    description: 'Search for a land in the Minecraft server',
    options: [{
        name: 'name',
        type: 3,
        description: 'Name of the land to search for',
        required: true,
        autocomplete: true
    }]
};

export async function execute(interaction) {
    const searchTerm = interaction.options.getString('name');
    const lands = await fetchLands();
    const land = lands.find(l => l.name.toLowerCase() === searchTerm.toLowerCase());

    if (land) {
        const onlinePlayers = await fetchOnlinePlayers();
        const onlinePlayerNames = new Set(onlinePlayers.map(player => player.name.toLowerCase()));

        const onlineCount = land.playersList.filter(player => 
            onlinePlayerNames.has(player.toLowerCase())
        ).length;

        const sortedPlayers = land.playersList.slice()
            .sort((a, b) => {
                const aOnline = onlinePlayerNames.has(a.toLowerCase());
                const bOnline = onlinePlayerNames.has(b.toLowerCase());
                return bOnline - aOnline; // Online players come first
            })
            .map(player => onlinePlayerNames.has(player.toLowerCase()) ? `🟢 ${player}` : player);

        const embed = {
            color: 0x0099ff,
            title: `🏰 ${land.name}`,
            fields: [
                {
                    name: 'Coordinates',
                    value: `X: ${land.x || 'Unknown'}\nZ: ${land.z || 'Unknown'}`,
                    inline: true
                },
                {
                    name: 'Players',
                    value: `Online players: ${onlineCount}/${land.playersCount}\n\`\`\`${sortedPlayers.slice(0, 10).join(', ')}${sortedPlayers.length > 10 ? '...' : ''}\`\`\``,
                    inline: true
                },
                {
                    name: 'Nation',
                    value: land.nationName === 'None' ? 
                        'Independent land' : 
                        `**${land.nationName}**\n${land.nationInfo.slice(0, 200)}${land.nationInfo.length > 200 ? '...' : ''}`,
                    inline: false
                }
            ],
            footer: {
                text: 'Land information from Atlas Map'
            }
        };

        await interaction.reply({
            embeds: [embed],
            ephemeral: true
        });
    } else {
        await interaction.reply({
            content: 'Land not found.',
            ephemeral: true
        });
    }
}

export async function autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const lands = await fetchLands();
    const filtered = lands
        .filter(land => land.name.toLowerCase().startsWith(focusedValue.toLowerCase()))
        .slice(0, 25);

    await interaction.respond(filtered.map(land => ({
        name: land.name,
        value: land.name
    })));
}
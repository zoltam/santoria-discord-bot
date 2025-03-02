import { getMineflayerBot } from '../mineflayerBot.js';
import { EmbedBuilder } from 'discord.js';
import { fetchLands } from '../utils.js';
import { fetchOnlinePlayers } from '../utils.js';

export const data = {
    name: 'rep',
    description: 'Show reputations of online players'
};

export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const bot = getMineflayerBot();
        
        // Get reputations
        const result = await bot.getReputations();
        
        if (!result.success) {
            await interaction.editReply(`Failed to get reputation data: ${result.message}`);
            return;
        }
        
        // Convert Map to array and filter reputations <= 20
        const reputations = Array.from(result.data.values())
            .filter(rep => rep.points <= 20)
            .sort((a, b) => a.points - b.points); // Sort by lowest reputation first
            
        if (reputations.length === 0) {
            await interaction.editReply('No players with reputation 20 or lower are currently online.');
            return;
        }
        
        // Fetch lands and online players
        const lands = await fetchLands();
        const onlinePlayers = await fetchOnlinePlayers();

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
            .setTitle('⚠️ Low Reputation Players Online')
            .setDescription(result.cached ? '*Data is cached (max 5 minutes old)*' : '*Data is fresh*')
            .setTimestamp();
            
        // Add fields for each player
        for (const rep of reputations) {
            const skull = rep.points <= 0 ? '💀 ' : '';
            const playerInfo = playerMap.get(rep.name.toLowerCase());
            const land = playerInfo ? playerInfo.landName : 'Unknown';
            const coordinates = playerInfo ? playerInfo.coordinates : 'Unknown';
            
            embed.addFields({
                name: `${skull}${rep.name} (${rep.points})`,
                value: `**${rep.title}** | +${rep.hourlyGain}/hr\n**Land:** ${land}\n**Coordinates:** ${coordinates}`,
                inline: false
            });
        }
        
        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error executing rep command:', error);
        await interaction.editReply('An error occurred while fetching reputation data.');
    }
}
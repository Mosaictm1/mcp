import axios from 'axios';
import * as cheerio from 'cheerio';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// n8n documentation base URL
const N8N_DOCS_BASE = 'https://docs.n8n.io/integrations/builtin/';

// Categories to scrape
const CATEGORIES = [
    'app-nodes',
    'core-nodes',
    'trigger-nodes',
    'cluster-nodes',
];

interface NodeInfo {
    nodeType: string;
    displayName: string;
    category: string;
    description: string;
    documentation: string;
    inputSchema: object;
    outputSchema: object;
    credentials: object;
    version: string;
}

async function fetchNodeList(category: string): Promise<string[]> {
    console.log(`📂 Fetching node list for category: ${category}`);

    try {
        const response = await axios.get(`${N8N_DOCS_BASE}${category}/`, {
            headers: { 'User-Agent': 'n8n-autopilot-scraper/1.0' },
        });

        const $ = cheerio.load(response.data);
        const nodeLinks: string[] = [];

        // Find all node links in the sidebar or content
        $('a[href*="/integrations/builtin/"]').each((_, el) => {
            const href = $(el).attr('href');
            if (href && href.includes(category) && !href.endsWith(`/${category}/`)) {
                const nodeName = href.split('/').filter(Boolean).pop();
                if (nodeName && !nodeLinks.includes(nodeName)) {
                    nodeLinks.push(nodeName);
                }
            }
        });

        console.log(`  Found ${nodeLinks.length} nodes in ${category}`);
        return nodeLinks;
    } catch (error) {
        console.error(`  Error fetching ${category}:`, error);
        return [];
    }
}

async function fetchNodeDocumentation(category: string, nodeName: string): Promise<NodeInfo | null> {
    const url = `${N8N_DOCS_BASE}${category}/${nodeName}/`;

    try {
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'n8n-autopilot-scraper/1.0' },
            timeout: 10000,
        });

        const $ = cheerio.load(response.data);

        // Extract title
        const title = $('h1').first().text().trim() || nodeName;

        // Extract description
        const description = $('meta[name="description"]').attr('content')
            || $('p').first().text().trim().substring(0, 500)
            || `${title} node for n8n`;

        // Extract full documentation content
        const mainContent = $('main, article, .content, .markdown-body')
            .first()
            .text()
            .trim()
            .substring(0, 10000); // Limit to 10k chars

        // Map category to n8n node type format
        const nodeType = `n8n-nodes-base.${nodeName.replace(/-/g, '')}`;

        // Extract credentials if mentioned
        const credentialsMatch = mainContent.match(/credential[s]?:?\s*([A-Za-z0-9]+(?:Api|OAuth|Auth)?)/gi);
        const credentials = credentialsMatch
            ? { required: credentialsMatch.map(c => c.replace(/credentials?:?\s*/i, '').trim()) }
            : { required: [] };

        return {
            nodeType,
            displayName: title.replace(' node', '').replace(' Node', ''),
            category: mapCategory(category),
            description: description.substring(0, 500),
            documentation: mainContent,
            inputSchema: { type: 'object', properties: {} },
            outputSchema: { type: 'object', properties: {} },
            credentials,
            version: '1.0',
        };
    } catch (error: any) {
        if (error.response?.status !== 404) {
            console.error(`  Error fetching ${nodeName}:`, error.message);
        }
        return null;
    }
}

function mapCategory(urlCategory: string): string {
    const mapping: Record<string, string> = {
        'app-nodes': 'App Nodes',
        'core-nodes': 'Core Nodes',
        'trigger-nodes': 'Trigger Nodes',
        'cluster-nodes': 'Cluster Nodes',
    };
    return mapping[urlCategory] || urlCategory;
}

async function createEmbedding(text: string): Promise<number[]> {
    const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text.substring(0, 8000), // Limit input size
    });
    return response.data[0].embedding;
}

async function saveNode(node: NodeInfo, embedding: number[]): Promise<void> {
    try {
        await prisma.n8nNode.upsert({
            where: { nodeType: node.nodeType },
            update: {
                displayName: node.displayName,
                category: node.category,
                description: node.description,
                documentation: node.documentation,
                inputSchema: node.inputSchema,
                outputSchema: node.outputSchema,
                credentials: node.credentials,
                version: node.version,
                lastScraped: new Date(),
            },
            create: {
                nodeType: node.nodeType,
                displayName: node.displayName,
                category: node.category,
                description: node.description,
                documentation: node.documentation,
                inputSchema: node.inputSchema,
                outputSchema: node.outputSchema,
                credentials: node.credentials,
                version: node.version,
            },
        });

        // Update embedding using raw SQL (pgvector)
        await prisma.$executeRaw`
      UPDATE "N8nNode" 
      SET embedding = ${embedding}::vector 
      WHERE "nodeType" = ${node.nodeType}
    `;

        console.log(`  ✅ Saved: ${node.displayName}`);
    } catch (error: any) {
        console.error(`  ❌ Error saving ${node.displayName}:`, error.message);
    }
}

async function scrapeAllNodes(): Promise<void> {
    console.log('🚀 Starting n8n documentation scraper...\n');

    let totalNodes = 0;
    let savedNodes = 0;

    for (const category of CATEGORIES) {
        console.log(`\n📁 Processing category: ${category}`);

        const nodeNames = await fetchNodeList(category);
        totalNodes += nodeNames.length;

        for (const nodeName of nodeNames) {
            const node = await fetchNodeDocumentation(category, nodeName);

            if (node) {
                // Create embedding from description + documentation
                const textForEmbedding = `${node.displayName}: ${node.description}. ${node.documentation.substring(0, 2000)}`;
                const embedding = await createEmbedding(textForEmbedding);

                await saveNode(node, embedding);
                savedNodes++;

                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    }

    console.log(`\n✨ Scraping complete!`);
    console.log(`   Total nodes found: ${totalNodes}`);
    console.log(`   Nodes saved: ${savedNodes}`);
}

// Alternative: Use n8n's public node list JSON
async function scrapeFromN8nNodeList(): Promise<void> {
    console.log('🚀 Fetching from n8n node registry...\n');

    try {
        // n8n exposes node info at this endpoint
        const response = await axios.get('https://api.n8n.io/api/templates/node-types', {
            headers: { 'User-Agent': 'n8n-autopilot-scraper/1.0' },
        });

        const nodes = response.data;
        console.log(`Found ${nodes.length} nodes in registry`);

        let savedCount = 0;

        for (const node of nodes) {
            try {
                const nodeInfo: NodeInfo = {
                    nodeType: node.name || `n8n-nodes-base.${node.displayName?.toLowerCase().replace(/\s/g, '')}`,
                    displayName: node.displayName || node.name,
                    category: node.group?.[0] || 'Other',
                    description: node.description || '',
                    documentation: node.description || '',
                    inputSchema: { type: 'object', properties: {} },
                    outputSchema: { type: 'object', properties: {} },
                    credentials: { required: node.credentials || [] },
                    version: node.version?.toString() || '1',
                };

                // Create embedding
                const textForEmbedding = `${nodeInfo.displayName}: ${nodeInfo.description}`;
                const embedding = await createEmbedding(textForEmbedding);

                await saveNode(nodeInfo, embedding);
                savedCount++;

                // Rate limiting for OpenAI
                if (savedCount % 10 === 0) {
                    console.log(`  Progress: ${savedCount}/${nodes.length}`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } catch (error: any) {
                console.error(`  Error processing node:`, error.message);
            }
        }

        console.log(`\n✨ Complete! Saved ${savedCount} nodes with embeddings.`);
    } catch (error: any) {
        console.error('Failed to fetch from n8n API:', error.message);
        console.log('Falling back to web scraping...');
        await scrapeAllNodes();
    }
}

// Main execution
async function main() {
    try {
        // Try API first, fall back to scraping
        await scrapeFromN8nNodeList();
    } catch (error) {
        console.error('Scraper failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();

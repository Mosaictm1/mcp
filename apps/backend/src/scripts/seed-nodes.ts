/**
 * Seed script to populate the database with common n8n nodes
 * This provides a baseline without requiring API calls
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Common n8n nodes with basic documentation
const COMMON_NODES = [
    {
        nodeType: 'n8n-nodes-base.gmail',
        displayName: 'Gmail',
        category: 'Communication',
        description: 'Read, send, and manage emails using Gmail. Supports triggers for new emails, sending messages, and managing labels.',
        credentials: { required: ['gmailOAuth2Api'] },
    },
    {
        nodeType: 'n8n-nodes-base.gmailTrigger',
        displayName: 'Gmail Trigger',
        category: 'Trigger',
        description: 'Triggers when a new email is received in Gmail. Can filter by labels, sender, or subject.',
        credentials: { required: ['gmailOAuth2Api'] },
    },
    {
        nodeType: 'n8n-nodes-base.slack',
        displayName: 'Slack',
        category: 'Communication',
        description: 'Send messages, manage channels, and interact with Slack workspaces. Supports message formatting and file uploads.',
        credentials: { required: ['slackOAuth2Api'] },
    },
    {
        nodeType: 'n8n-nodes-base.googleSheets',
        displayName: 'Google Sheets',
        category: 'Data',
        description: 'Read, write, update, and delete data in Google Sheets. Supports batch operations and data formatting.',
        credentials: { required: ['googleSheetsOAuth2Api'] },
    },
    {
        nodeType: 'n8n-nodes-base.googleDrive',
        displayName: 'Google Drive',
        category: 'Data',
        description: 'Upload, download, and manage files in Google Drive. Supports folder operations and file sharing.',
        credentials: { required: ['googleDriveOAuth2Api'] },
    },
    {
        nodeType: 'n8n-nodes-base.httpRequest',
        displayName: 'HTTP Request',
        category: 'Core',
        description: 'Make HTTP requests to any API endpoint. Supports GET, POST, PUT, PATCH, DELETE methods with headers and authentication.',
        credentials: { required: [] },
    },
    {
        nodeType: 'n8n-nodes-base.webhook',
        displayName: 'Webhook',
        category: 'Trigger',
        description: 'Receive data via HTTP webhook. Creates a unique URL that can receive POST, GET, or other HTTP requests.',
        credentials: { required: [] },
    },
    {
        nodeType: 'n8n-nodes-base.scheduleTrigger',
        displayName: 'Schedule Trigger',
        category: 'Trigger',
        description: 'Trigger workflows on a schedule. Supports cron expressions, intervals, and specific times.',
        credentials: { required: [] },
    },
    {
        nodeType: 'n8n-nodes-base.if',
        displayName: 'IF',
        category: 'Core',
        description: 'Conditional branching. Routes data to different outputs based on conditions like equals, contains, greater than, etc.',
        credentials: { required: [] },
    },
    {
        nodeType: 'n8n-nodes-base.switch',
        displayName: 'Switch',
        category: 'Core',
        description: 'Route data to multiple outputs based on rules. Like IF but with many possible branches.',
        credentials: { required: [] },
    },
    {
        nodeType: 'n8n-nodes-base.set',
        displayName: 'Set',
        category: 'Core',
        description: 'Set or modify data fields. Add, edit, or remove properties from the workflow data.',
        credentials: { required: [] },
    },
    {
        nodeType: 'n8n-nodes-base.code',
        displayName: 'Code',
        category: 'Core',
        description: 'Execute custom JavaScript or Python code. Full access to workflow data with ability to transform or generate data.',
        credentials: { required: [] },
    },
    {
        nodeType: 'n8n-nodes-base.openAi',
        displayName: 'OpenAI',
        category: 'AI',
        description: 'Interact with OpenAI API. Generate text, analyze content, create embeddings, and use GPT models.',
        credentials: { required: ['openAiApi'] },
    },
    {
        nodeType: 'n8n-nodes-base.telegram',
        displayName: 'Telegram',
        category: 'Communication',
        description: 'Send messages, photos, and documents via Telegram bot. Manage chats and receive updates.',
        credentials: { required: ['telegramApi'] },
    },
    {
        nodeType: 'n8n-nodes-base.discord',
        displayName: 'Discord',
        category: 'Communication',
        description: 'Send messages and manage Discord servers. Supports webhooks and bot interactions.',
        credentials: { required: ['discordWebhookApi'] },
    },
    {
        nodeType: 'n8n-nodes-base.notion',
        displayName: 'Notion',
        category: 'Productivity',
        description: 'Create, read, update pages and databases in Notion. Manage blocks and properties.',
        credentials: { required: ['notionApi'] },
    },
    {
        nodeType: 'n8n-nodes-base.airtable',
        displayName: 'Airtable',
        category: 'Data',
        description: 'Read, create, update, and delete records in Airtable bases. Supports filtering and sorting.',
        credentials: { required: ['airtableApi'] },
    },
    {
        nodeType: 'n8n-nodes-base.postgres',
        displayName: 'PostgreSQL',
        category: 'Data',
        description: 'Execute SQL queries on PostgreSQL databases. Supports select, insert, update, delete operations.',
        credentials: { required: ['postgresql'] },
    },
    {
        nodeType: 'n8n-nodes-base.mysql',
        displayName: 'MySQL',
        category: 'Data',
        description: 'Execute SQL queries on MySQL databases. Full CRUD operations with parameterized queries.',
        credentials: { required: ['mysql'] },
    },
    {
        nodeType: 'n8n-nodes-base.mongodb',
        displayName: 'MongoDB',
        category: 'Data',
        description: 'Perform operations on MongoDB collections. Find, insert, update, delete documents.',
        credentials: { required: ['mongodb'] },
    },
    {
        nodeType: 'n8n-nodes-base.merge',
        displayName: 'Merge',
        category: 'Core',
        description: 'Merge data from multiple branches. Combine by index, key match, or all combinations.',
        credentials: { required: [] },
    },
    {
        nodeType: 'n8n-nodes-base.splitInBatches',
        displayName: 'Split In Batches',
        category: 'Core',
        description: 'Process items in smaller batches. Useful for rate limiting or processing large datasets.',
        credentials: { required: [] },
    },
    {
        nodeType: 'n8n-nodes-base.wait',
        displayName: 'Wait',
        category: 'Core',
        description: 'Pause workflow execution for a specified duration or until a specific time.',
        credentials: { required: [] },
    },
    {
        nodeType: 'n8n-nodes-base.dateTime',
        displayName: 'Date & Time',
        category: 'Core',
        description: 'Format, parse, and manipulate dates and times. Convert between formats and timezones.',
        credentials: { required: [] },
    },
    {
        nodeType: 'n8n-nodes-base.crypto',
        displayName: 'Crypto',
        category: 'Core',
        description: 'Hash, encrypt, and decrypt data. Supports various algorithms like MD5, SHA, AES.',
        credentials: { required: [] },
    },
    {
        nodeType: 'n8n-nodes-base.jira',
        displayName: 'Jira',
        category: 'Productivity',
        description: 'Create, update, and manage Jira issues. Search issues and manage projects.',
        credentials: { required: ['jiraApi'] },
    },
    {
        nodeType: 'n8n-nodes-base.github',
        displayName: 'GitHub',
        category: 'Development',
        description: 'Manage GitHub repositories, issues, pull requests, and releases.',
        credentials: { required: ['githubApi'] },
    },
    {
        nodeType: 'n8n-nodes-base.stripe',
        displayName: 'Stripe',
        category: 'Finance',
        description: 'Manage customers, payments, subscriptions, and invoices in Stripe.',
        credentials: { required: ['stripeApi'] },
    },
    {
        nodeType: 'n8n-nodes-base.sendGrid',
        displayName: 'SendGrid',
        category: 'Communication',
        description: 'Send emails and manage contacts using SendGrid email service.',
        credentials: { required: ['sendGridApi'] },
    },
    {
        nodeType: 'n8n-nodes-base.twilio',
        displayName: 'Twilio',
        category: 'Communication',
        description: 'Send SMS messages and make voice calls using Twilio.',
        credentials: { required: ['twilioApi'] },
    },
];

async function seedNodes() {
    console.log('🌱 Seeding common n8n nodes...\n');

    let count = 0;

    for (const node of COMMON_NODES) {
        try {
            await prisma.n8nNode.upsert({
                where: { nodeType: node.nodeType },
                update: {
                    displayName: node.displayName,
                    category: node.category,
                    description: node.description,
                    documentation: node.description,
                    credentials: node.credentials,
                    lastScraped: new Date(),
                },
                create: {
                    nodeType: node.nodeType,
                    displayName: node.displayName,
                    category: node.category,
                    description: node.description,
                    documentation: node.description,
                    inputSchema: {},
                    outputSchema: {},
                    credentials: node.credentials,
                    version: '1',
                },
            });
            console.log(`  ✅ ${node.displayName}`);
            count++;
        } catch (error: any) {
            console.error(`  ❌ ${node.displayName}: ${error.message}`);
        }
    }

    console.log(`\n✨ Seeded ${count} nodes successfully!`);
}

async function main() {
    try {
        await seedNodes();
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();

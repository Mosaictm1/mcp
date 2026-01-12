import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * Webhook payload structure from Composio
 */
export interface ComposioWebhookPayload {
    type: string;
    data: Record<string, any>;
    timestamp: string;
    log_id: string;
}

/**
 * Webhook event handlers interface
 */
export interface WebhookEventHandler {
    (data: Record<string, any>): Promise<void>;
}

@Injectable()
export class ComposioWebhookService {
    private readonly logger = new Logger(ComposioWebhookService.name);
    private eventHandlers: Map<string, WebhookEventHandler[]> = new Map();

    constructor(private config: ConfigService) { }

    /**
     * Verify webhook signature (HMAC-SHA256)
     * 
     * Composio signs all webhook requests so you can verify they're authentic.
     * Each webhook includes:
     * - webhook-signature: HMAC signature in format v1,<base64_signature>
     * - webhook-id: Unique message identifier
     * - webhook-timestamp: Unix timestamp when the webhook was sent
     */
    verifySignature(
        signature: string,
        webhookId: string,
        timestamp: string,
        body: string,
    ): boolean {
        const secret = this.config.get<string>('COMPOSIO_WEBHOOK_SECRET');

        if (!secret) {
            this.logger.warn('⚠️ COMPOSIO_WEBHOOK_SECRET not configured - skipping verification');
            // Allow in development, but log warning
            return this.config.get('NODE_ENV') !== 'production';
        }

        if (!signature || !webhookId || !timestamp) {
            this.logger.error('Missing required webhook headers');
            return false;
        }

        if (!signature.startsWith('v1,')) {
            this.logger.error('Invalid signature format - must start with v1,');
            return false;
        }

        const received = signature.substring(3);
        const signingString = `${webhookId}.${timestamp}.${body}`;

        try {
            const expected = crypto
                .createHmac('sha256', secret)
                .update(signingString)
                .digest('base64');

            // Use timing-safe comparison to prevent timing attacks
            const isValid = crypto.timingSafeEqual(
                Buffer.from(received),
                Buffer.from(expected),
            );

            if (!isValid) {
                this.logger.error('Webhook signature verification failed');
            }

            return isValid;
        } catch (error: any) {
            this.logger.error(`Signature verification error: ${error.message}`);
            return false;
        }
    }

    /**
     * Register an event handler for a specific trigger type
     */
    on(eventType: string, handler: WebhookEventHandler): void {
        const handlers = this.eventHandlers.get(eventType) || [];
        handlers.push(handler);
        this.eventHandlers.set(eventType, handlers);
        this.logger.log(`Registered handler for event: ${eventType}`);
    }

    /**
     * Process verified webhook payload
     */
    async handleWebhook(payload: ComposioWebhookPayload): Promise<void> {
        const { type, data, log_id, timestamp } = payload;
        this.logger.log(`📥 Processing webhook: ${type} (log_id: ${log_id}, timestamp: ${timestamp})`);

        // Get registered handlers for this event type
        const handlers = this.eventHandlers.get(type) || [];

        if (handlers.length === 0) {
            // No registered handlers, use default handling
            await this.handleDefaultEvent(type, data);
            return;
        }

        // Execute all registered handlers
        for (const handler of handlers) {
            try {
                await handler(data);
            } catch (error: any) {
                this.logger.error(`Handler error for ${type}: ${error.message}`);
            }
        }
    }

    /**
     * Default event handling when no specific handler is registered
     */
    private async handleDefaultEvent(type: string, data: Record<string, any>): Promise<void> {
        switch (type) {
            // GitHub events
            case 'github_star_added_event':
                this.logger.log(`⭐ GitHub star added: ${data.repository_name} by ${data.starred_by}`);
                break;

            case 'github_issue_created':
                this.logger.log(`🐛 GitHub issue created: ${data.title} in ${data.repository}`);
                break;

            case 'github_pull_request_opened':
                this.logger.log(`🔀 GitHub PR opened: ${data.title} by ${data.author}`);
                break;

            // Gmail events
            case 'gmail_new_email':
                this.logger.log(`📧 New email from: ${data.from}, subject: ${data.subject}`);
                break;

            // Slack events
            case 'slack_message':
                this.logger.log(`💬 Slack message in ${data.channel}: ${data.text?.substring(0, 50)}...`);
                break;

            case 'slack_mention':
                this.logger.log(`🔔 Slack mention by ${data.user} in ${data.channel}`);
                break;

            // Notion events
            case 'notion_page_created':
                this.logger.log(`📝 Notion page created: ${data.title}`);
                break;

            case 'notion_page_updated':
                this.logger.log(`📝 Notion page updated: ${data.title}`);
                break;

            // Linear events
            case 'linear_issue_created':
                this.logger.log(`📋 Linear issue created: ${data.title}`);
                break;

            case 'linear_issue_updated':
                this.logger.log(`📋 Linear issue updated: ${data.title}`);
                break;

            // Default
            default:
                this.logger.log(`🔔 Unhandled event type: ${type}`);
                this.logger.debug(`Event data: ${JSON.stringify(data)}`);
        }
    }

    /**
     * Get webhook configuration status
     */
    getStatus(): { configured: boolean; message: string } {
        const secret = this.config.get<string>('COMPOSIO_WEBHOOK_SECRET');
        const isProduction = this.config.get('NODE_ENV') === 'production';

        if (!secret) {
            return {
                configured: false,
                message: isProduction
                    ? 'COMPOSIO_WEBHOOK_SECRET required in production'
                    : 'COMPOSIO_WEBHOOK_SECRET not configured - verification disabled in development',
            };
        }

        return {
            configured: true,
            message: 'Webhook verification enabled',
        };
    }
}

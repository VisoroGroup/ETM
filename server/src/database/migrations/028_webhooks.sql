-- Webhook subscriptions (admin creates)
CREATE TABLE webhook_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url VARCHAR(2048) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    secret VARCHAR(500),
    description VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook delivery log (every send attempt)
CREATE TABLE webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    response_status INT,
    response_body TEXT,
    attempt INT DEFAULT 1,
    max_attempts INT DEFAULT 4,
    status VARCHAR(20) DEFAULT 'pending',
    next_retry_at TIMESTAMPTZ,
    error_message TEXT,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_webhook_subs_event ON webhook_subscriptions(event_type) WHERE is_active = true;
CREATE INDEX idx_webhook_deliveries_sub ON webhook_deliveries(subscription_id);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status) WHERE status IN ('pending', 'retrying');
CREATE INDEX idx_webhook_deliveries_retry ON webhook_deliveries(next_retry_at) WHERE status = 'retrying';

-- Constraint: allowed event types
ALTER TABLE webhook_subscriptions ADD CONSTRAINT chk_webhook_event_type
    CHECK (event_type IN (
        'task.created', 'task.completed', 'task.status_changed', 'task.assigned', 'task.overdue',
        'payment.due_soon', 'payment.overdue', 'payment.paid'
    ));

-- Delivery status constraint
ALTER TABLE webhook_deliveries ADD CONSTRAINT chk_delivery_status
    CHECK (status IN ('pending', 'sending', 'delivered', 'failed', 'retrying'));

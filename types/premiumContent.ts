export type TrailerDurationSeconds = 180 | 240 | 300; // Mandatory 3, 4, or 5 minutes

export interface PremiumContent {
  id: string;
  creator_id: string;
  creator_name?: string;
  title: string;
  description?: string;
  preview_video_url: string;
  full_video_storage_path: string;
  free_preview_duration_seconds: TrailerDurationSeconds;
  price_cents: number;
  currency: string;
  is_active: boolean;
  creator_split_bps?: number; // Default: 8000 (80% Creator / 20% METFA)
  created_at: string;
  updated_at: string;
}

export interface PremiumPurchase {
  id: string;
  content_id: string;
  viewer_id: string;
  creator_id: string;
  amount_cents: number;
  currency: string;
  payment_method: 'METFA_WALLET' | 'EXTERNAL_PAYMENT';
  wallet_ledger_id?: string;
  creator_wallet_ledger_id?: string;
  platform_fee_cents: number;
  creator_amount_cents: number;
  status: 'COMPLETED' | 'REFUNDED' | 'DISPUTED';
  refund_reason?: string;
  refunded_at?: string;
  created_at: string;
  updated_at: string;
}

export type LiveAccessTier = 'LIVE_ONLY' | 'LIVE_AND_PERMANENT_REPLAY';
export type LiveSessionStatus = 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED';
export type LiveRecordingStatus = 'NONE' | 'RECORDING' | 'FINALIZING' | 'PUBLISHED' | 'FAILED';

export interface PremiumLiveSession {
  id: string;
  creator_id: string;
  creator_name?: string;
  title: string;
  description?: string;
  scheduled_start_time: string;
  status: LiveSessionStatus;
  live_price_cents: number;
  replay_price_cents: number;
  currency: string;
  live_channel_id: string;
  recording_storage_path?: string;
  recording_status: LiveRecordingStatus;
  recording_failure_reason?: string;
  published_at?: string;
  retention_protected: boolean;
  creator_split_bps?: number; // Default 8000 (80% Creator / 20% METFA)
  created_at: string;
  updated_at: string;
}

export interface PremiumLivePurchase {
  id: string;
  session_id: string;
  viewer_id: string;
  creator_id: string;
  access_tier: LiveAccessTier;
  amount_cents: number;
  currency: string;
  payment_method: 'METFA_WALLET' | 'EXTERNAL_PAYMENT';
  wallet_ledger_id?: string;
  creator_wallet_ledger_id?: string;
  platform_fee_cents: number;
  creator_amount_cents: number;
  status: 'COMPLETED' | 'REFUNDED' | 'DISPUTED';
  refund_reason?: string;
  refunded_at?: string;
  created_at: string;
  updated_at: string;
}

export interface OrdinaryLiveVideo {
  id: string;
  creator_id: string;
  title: string;
  storage_path: string;
  created_at: string;
  expires_at: string; // Exactly 30 days after creation
  is_purged: boolean;
  purged_at?: string;
}

export interface CleanupJobResult {
  timestamp: string;
  total_scanned: number;
  ordinary_purged_count: number;
  premium_replays_protected_count: number;
  premium_expired_unentitled_purged_count: number;
  purged_file_paths: string[];
  protected_session_ids: string[];
}

export interface StreamAuthorizationResponse {
  authorized: boolean;
  stream_url?: string;
  expires_at?: string;
  error?: string;
  price_cents?: number;
  free_preview_duration_seconds?: number;
  preview_url?: string;
  recording_status?: LiveRecordingStatus;
  access_tier?: LiveAccessTier;
}

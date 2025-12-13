export type Sequence = {
  id: string;
  user_id: string | null;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
};

export type SequenceStep = {
  id: string;
  sequence_id: string;
  step_number: number;
  delay_minutes: number | null;
  body_template: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type SequenceEnrollment = {
  id: string;
  sequence_id: string;
  user_id: string;
  property_id: string;
  current_step: number;
  next_run_at: string | null;
  is_paused: boolean;
  completed_at: string | null;
  last_error: string | null;
  last_error_at?: string | null;
  created_at: string;
  sequence: {
    name: string;
  } | null;
};

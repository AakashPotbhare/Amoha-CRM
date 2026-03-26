
-- Chat conversations (1:1 between employees)
CREATE TABLE public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_one uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  participant_two uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(participant_one, participant_two)
);

-- Chat messages
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  content text,
  file_url text,
  file_name text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add constraint: content max 2000 chars via trigger
CREATE OR REPLACE FUNCTION public.validate_chat_message()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.content IS NOT NULL AND length(NEW.content) > 2000 THEN
    RAISE EXCEPTION 'Message content exceeds 2000 characters';
  END IF;
  IF NEW.content IS NULL AND NEW.file_url IS NULL THEN
    RAISE EXCEPTION 'Message must have content or a file';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_chat_message_trigger
  BEFORE INSERT OR UPDATE ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.validate_chat_message();

-- RLS for conversations
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can read own conversations"
  ON public.chat_conversations FOR SELECT TO authenticated
  USING (
    participant_one = get_current_employee_id() OR 
    participant_two = get_current_employee_id()
  );

CREATE POLICY "Authenticated can create conversations"
  ON public.chat_conversations FOR INSERT TO authenticated
  WITH CHECK (
    participant_one = get_current_employee_id() OR 
    participant_two = get_current_employee_id()
  );

CREATE POLICY "Participants can update own conversations"
  ON public.chat_conversations FOR UPDATE TO authenticated
  USING (
    participant_one = get_current_employee_id() OR 
    participant_two = get_current_employee_id()
  );

-- RLS for messages
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can read conversation messages"
  ON public.chat_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = conversation_id
      AND (c.participant_one = get_current_employee_id() OR c.participant_two = get_current_employee_id())
    )
  );

CREATE POLICY "Sender can insert messages"
  ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = get_current_employee_id() AND
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = conversation_id
      AND (c.participant_one = get_current_employee_id() OR c.participant_two = get_current_employee_id())
    )
  );

CREATE POLICY "Participants can update messages read status"
  ON public.chat_messages FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = conversation_id
      AND (c.participant_one = get_current_employee_id() OR c.participant_two = get_current_employee_id())
    )
  );

-- Enable realtime for chat_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;

-- Indexes
CREATE INDEX idx_chat_messages_conversation ON public.chat_messages(conversation_id, created_at);
CREATE INDEX idx_chat_messages_sender ON public.chat_messages(sender_id);
CREATE INDEX idx_chat_conversations_participants ON public.chat_conversations(participant_one, participant_two);

-- Storage bucket for chat attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-attachments', 'chat-attachments', true);

CREATE POLICY "Authenticated can upload chat attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments');

CREATE POLICY "Anyone can read chat attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-attachments');

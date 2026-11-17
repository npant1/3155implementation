-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "lastMessageAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "clientMessageId" UUID;

-- CreateIndex
CREATE INDEX "Conversation_studentId_lastMessageAt_idx" ON "Conversation"("studentId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_professorId_lastMessageAt_idx" ON "Conversation"("professorId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "Message_senderId_clientMessageId_key" ON "Message"("senderId", "clientMessageId");

-- Preserve existing conversation activity when adding the inbox ordering field.
UPDATE "Conversation" c SET "lastMessageAt" = COALESCE(
  (SELECT MAX(m."sentAt") FROM "Message" m WHERE m."conversationId" = c.id), c."createdAt");
CREATE FUNCTION update_conversation_activity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "Conversation" SET "lastMessageAt" = GREATEST("lastMessageAt", NEW."sentAt") WHERE id = NEW."conversationId";
  RETURN NEW;
END $$;
CREATE TRIGGER conversation_message_activity AFTER INSERT ON "Message" FOR EACH ROW EXECUTE FUNCTION update_conversation_activity();

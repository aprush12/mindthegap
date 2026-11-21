import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, TextInput, View, type ScrollViewInstance } from 'react-native';
import { EmergencyBanner } from '../../../components/handoff/Banners';
import { QuoteChip } from '../../../components/handoff/BriefItems';
import { IdentityBannerPhone } from '../../../components/handoff/IdentityBanner';
import { ThreadMessageView } from '../../../components/handoff/Messages';
import { Icon } from '../../../components/Icon';
import { useBottomInset } from '../../../components/layout/Phone';
import { NavIconButton, PhoneNavBar, goBack } from '../../../components/phone/Parts';
import { DemoWatermark, ErrorState, Loading } from '../../../components/ui/States';
import { T } from '../../../components/ui/Text';
import { getBrief, getCurrentUser, getHandoff, getThread, sendMessage, sourceFor, withAuthor, type ThreadMessage } from '../../../lib/api';
import { useQuery } from '../../../lib/api/useQuery';
import { fmtDayHeading } from '../../../lib/clock';
import { color, font } from '../../../theme/tokens';

/**
 * iPhone secure thread (design PhoneThread). Patient name + DOB pinned. The mic opens Capture,
 * where a voice note is transcribed and reviewed; nothing recorded here is ever sent automatically.
 * `?ask=<unclearId>` pre-fills a question quoting an unclear brief item.
 */
export default function PhoneThreadScreen() {
  const { id, ask } = useLocalSearchParams<{ id: string; ask?: string }>();
  const { data: view, loading } = useQuery(() => getHandoff(id), [id]);
  const { data: live } = useQuery(() => getThread(id), [id]);
  const { data: brief } = useQuery(() => getBrief(id), [id]);
  const bottom = useBottomInset();
  const me = getCurrentUser();
  const [text, setText] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [quote, setQuote] = useState<ThreadMessage['quote']>();
  const [sending, setSending] = useState(false);
  const scroller = useRef<ScrollViewInstance>(null);

  useEffect(() => {
    const u = brief?.unclear.find((x) => x.id === ask);
    if (!brief || !u) return;
    setText(u.suggestedQuestion);
    setQuote({ kind: 'unclear', text: u.text, page: sourceFor(brief, u.sourceId).page });
  }, [brief, ask]);

  const messages = (live ?? []).map(withAuthor);
  useEffect(() => {
    const t = setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [messages.length]);

  if (loading) return <Loading />;
  if (!view) return <ErrorState title="Thread not found" body="This thread doesn't exist or you don't have access to it." />;

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await sendMessage(view.handoff.id, { text, urgent, quote });
      setText('');
      setQuote(undefined);
      setUrgent(false);
    } finally {
      setSending(false);
    }
  };

  let lastDay = '';
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.bgCanvas }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ backgroundColor: color.bgCanvas, borderBottomWidth: 1, borderBottomColor: color.borderDefault, paddingBottom: 10, zIndex: 10 }}>
        <PhoneNavBar
          backLabel="Threads"
          onBack={() => goBack('/m/threads')}
          title={view.from.short}
          subtitle="(demo) · secure thread"
          right={<NavIconButton icon="phone" label="Call hospital on-call line" onPress={() => Linking.openURL('tel:').catch(() => {})} />}
        />
        <View style={{ marginHorizontal: 12 }}>
          <IdentityBannerPhone name={view.patient.name} initials={view.patient.initials} dob={view.patient.dob} age={view.patient.ageYears} style={{ paddingVertical: 10, paddingRight: 84 }} />
          <View style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Open brief" onPress={() => router.push(`/m/brief/${view.handoff.id}` as never)} style={{ height: 36, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: color.borderStrong, justifyContent: 'center', backgroundColor: color.bgSurface }}>
              <T size={15} weight={600}>
                Brief
              </T>
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView ref={scroller} style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 12, paddingHorizontal: 12, paddingBottom: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
        {messages.length === 0 ? (
          <T size={15} color={color.textTertiary} align="center" style={{ paddingVertical: 24 }}>
            No messages yet. Questions you send here go to {view.from.name}.
          </T>
        ) : null}
        {messages.map((m) => {
          const day = fmtDayHeading(m.at);
          const sep = day !== lastDay;
          lastDay = day;
          return (
            <View key={m.id} style={{ gap: 14 }}>
              {sep ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: color.borderDefault }} />
                  <T size={13} weight={600} color={color.textTertiary}>
                    {day}
                  </T>
                  <View style={{ flex: 1, height: 1, backgroundColor: color.borderDefault }} />
                </View>
              ) : null}
              <ThreadMessageView msg={m} phone mine={m.author.orgId === me.orgId} onBriefMatch={m.voice?.briefMatch ? () => router.push(`/m/pdf/${view.handoff.id}?source=warn` as never) : undefined} />
            </View>
          );
        })}
      </ScrollView>

      {/* Composer */}
      <View style={{ backgroundColor: color.bgSurface, borderTopWidth: 1, borderTopColor: color.borderDefault, paddingTop: 10, paddingHorizontal: 12, paddingBottom: Math.max(bottom, 10) + 6, gap: 10 }}>
        {urgent ? <EmergencyBanner compact onCall={false} extra="Urgent marks the message; it does not call anyone." /> : null}
        {quote ? <QuoteChip kind={quote.kind === 'unclear' ? 'Unclear' : 'Brief'} text={quote.text} page={quote.page} onClear={() => setQuote(undefined)} /> : null}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel="Mark as urgent"
            accessibilityState={{ checked: urgent }}
            onPress={() => setUrgent((u) => !u)}
            style={{ width: 44, height: 44, borderRadius: 999, borderWidth: 1, borderColor: urgent ? color.critical : color.borderDefault, backgroundColor: urgent ? color.criticalBg : color.bgSurface, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="flag-urgent" size={20} color={urgent ? color.critical : color.textSecondary} />
          </Pressable>
          <View style={{ flex: 1, minHeight: 44, borderWidth: 1, borderColor: urgent ? color.critical : color.borderStrong, borderRadius: 22, paddingHorizontal: 14, justifyContent: 'center' }}>
            <TextInput
              accessibilityLabel={`Message ${view.from.short}`}
              value={text}
              onChangeText={setText}
              placeholder={urgent ? 'Urgent message' : 'Message'}
              placeholderTextColor={color.textTertiary}
              multiline
              numberOfLines={1}
              style={[{ fontFamily: font.regular, fontSize: 17, lineHeight: 22, color: color.textPrimary, paddingVertical: 10, maxHeight: 120 }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
            />
          </View>
          {text.trim() ? (
            <Pressable accessibilityRole="button" accessibilityLabel={urgent ? 'Send urgent message' : 'Send message'} disabled={sending} onPress={send} style={{ width: 44, height: 44, borderRadius: 999, backgroundColor: urgent ? color.critical : color.accent, alignItems: 'center', justifyContent: 'center', opacity: sending ? 0.6 : 1 }}>
              <Icon name="send" size={20} color="#FFFFFF" />
            </Pressable>
          ) : (
            // Voice replies go through Capture: record → review transcript → confirm patient → send.
            <Pressable accessibilityRole="button" accessibilityLabel="Record a voice reply" accessibilityHint="Opens Capture. You review before anything is sent." onPress={() => router.navigate('/m/capture' as never)} style={{ width: 44, height: 44, borderRadius: 999, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="mic" size={20} color="#FFFFFF" />
            </Pressable>
          )}
        </View>
      </View>
      <DemoWatermark phone />
    </KeyboardAvoidingView>
  );
}

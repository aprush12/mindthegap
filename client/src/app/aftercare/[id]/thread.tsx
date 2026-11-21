import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, TextInput, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import { EmergencyBanner } from '../../../components/handoff/Banners';
import { QuoteChip } from '../../../components/handoff/BriefItems';
import { HandoffHeader } from '../../../components/handoff/HandoffHeader';
import { PulseRing, ThreadMessageView } from '../../../components/handoff/Messages';
import { Icon } from '../../../components/Icon';
import { AppBar, MAX_W } from '../../../components/layout/Shell';
import { AiLabel, PriorityBadge, SourceLink, UnclearBadge } from '../../../components/ui/Badges';
import { Button } from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Controls';
import { DemoWatermark, ErrorState, Loading } from '../../../components/ui/States';
import { T } from '../../../components/ui/Text';
import { getBrief, getCurrentUser, getHandoff, logPageView, sendMessage, sourceFor, transcribeVoiceNote, withAuthor, type Brief, type HandoffView, type Priority, type ThreadEntry } from '../../../lib/api';
import { getThreadWithHistory, readReceipt } from '../../../lib/api/aftercare-extra';
import { useQuery } from '../../../lib/api/useQuery';
import { fmtClock, fmtDayHeading } from '../../../lib/clock';
import { color, font, radius, shadow } from '../../../theme/tokens';

/** A brief item the composer can quote ("Asking about … p.X"). */
interface AskItem {
  id: string;
  kind: 'brief' | 'unclear';
  priority?: Priority;
  text: string;
  page: number;
}

function askItems(brief?: Brief): AskItem[] {
  if (!brief) return [];
  const items: AskItem[] = brief.groups.flatMap((g) => g.items.map((i) => ({ id: i.id, kind: 'brief' as const, priority: i.priority, text: i.text, page: sourceFor(brief, i.sourceId).page })));
  return [...items, ...brief.unclear.map((u) => ({ id: u.id, kind: 'unclear' as const, text: u.text, page: sourceFor(brief, u.sourceId).page }))];
}

/** Secure per-patient thread between hospital and facility. Never the emergency channel. */
export default function ThreadScreen() {
  const { id, ask } = useLocalSearchParams<{ id: string; ask?: string }>();
  const { data: view, loading } = useQuery(() => getHandoff(id), [id]);
  const { data: brief } = useQuery(() => getBrief(id), [id]);
  const { data: thread } = useQuery(() => getThreadWithHistory(id), [id]);
  const { width } = useWindowDimensions();
  const wide = width >= 1100;
  const pad = width < 900 ? 16 : 32;
  const [quoteId, setQuoteId] = useState<string | null>(ask ?? null);
  const logged = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!id || logged.current === id) return;
    logged.current = id;
    logPageView(id, 'Thread');
  }, [id]);

  if (loading) return <Loading />;
  if (!view) return <ErrorState title="Handoff not found" body="This handoff doesn't exist or you don't have access to it." />;

  const items = askItems(brief);
  const quote = items.find((i) => i.id === quoteId) ?? null;
  const entries = (thread ?? []).map(withAuthor);

  const conversation = <Conversation view={view} entries={entries} wide={wide} quote={quote} onClearQuote={() => setQuoteId(null)} items={items} onAsk={setQuoteId} />;

  return (
    <View style={{ flex: 1, backgroundColor: color.bgCanvas }}>
      <AppBar side="aftercare" />
      <View style={[{ backgroundColor: color.bgCanvas, borderBottomWidth: 1, borderBottomColor: color.borderDefault, zIndex: 10 }, shadow.banner]}>
        <View style={{ maxWidth: MAX_W, width: '100%', alignSelf: 'center', paddingHorizontal: pad, paddingTop: 12 }}>
          <HandoffHeader view={view} tab="thread" />
        </View>
      </View>
      {wide ? (
        <View style={{ flex: 1, flexDirection: 'row', gap: 24, maxWidth: MAX_W, width: '100%', alignSelf: 'center', paddingHorizontal: pad, paddingVertical: 24 }}>
          <View style={{ flex: 1, minWidth: 0 }}>{conversation}</View>
          {items.length ? (
            <ScrollView style={{ width: 380, flexGrow: 0 }} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
              <BriefRail items={items} quoteId={quoteId} onAsk={setQuoteId} onSource={() => router.navigate(`/aftercare/${id}?tab=packet` as never)} />
            </ScrollView>
          ) : null}
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: pad, paddingVertical: 16, paddingBottom: 48 }}>{conversation}</ScrollView>
      )}
      <DemoWatermark />
    </View>
  );
}

function DayDivider({ label }: { label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: color.borderSubtle }} />
      <T size={13} weight={600} color={color.textTertiary}>
        {label}
      </T>
      <View style={{ flex: 1, height: 1, backgroundColor: color.borderSubtle }} />
    </View>
  );
}

function Conversation({ view, entries, wide, quote, onClearQuote, items, onAsk }: { view: HandoffView; entries: ThreadEntry[]; wide: boolean; quote: AskItem | null; onClearQuote: () => void; items: AskItem[]; onAsk: (id: string) => void }) {
  const me = getCurrentUser();
  const scroll = useRef<ScrollViewInstance>(null);
  const participants = new Set([me.id, ...entries.filter((e) => e.authorId !== 'system').map((e) => e.authorId)]).size;

  const list = (
    <View style={{ paddingVertical: 20, paddingHorizontal: wide ? 24 : 16, gap: 20 }}>
      {entries.map((m, i) => {
        const day = fmtDayHeading(m.at);
        const newDay = i === 0 || fmtDayHeading(entries[i - 1].at) !== day;
        const mine = m.authorId !== 'system' && m.author.orgId === me.orgId;
        const receipt = mine ? readReceipt(m) : undefined;
        return (
          <View key={m.id} style={{ gap: 20 }}>
            {newDay ? <DayDivider label={day} /> : null}
            <View style={m.voice ? { alignSelf: mine ? 'flex-end' : 'flex-start', width: '100%', maxWidth: 640 } : undefined}>
              <ThreadMessageView msg={m} mine={mine} onBriefMatch={() => router.navigate(`/aftercare/${view.handoff.id}?tab=packet` as never)} />
              {receipt ? (
                <T size={12} color={color.textTertiary} align="right" style={{ paddingTop: 6 }}>
                  {receipt}
                </T>
              ) : null}
            </View>
          </View>
        );
      })}
      {entries.length === 0 ? (
        <T size={14} color={color.textTertiary} align="center">
          No messages yet. Questions about this handoff go here; emergencies do not.
        </T>
      ) : null}
    </View>
  );

  return (
    <View accessibilityLabel={`Conversation with ${view.from.name}`} style={{ flex: wide ? 1 : undefined, backgroundColor: color.bgSurface, borderWidth: 1, borderColor: color.borderDefault, borderRadius: radius.lg, overflow: 'hidden' }}>
      <View style={{ paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: color.borderDefault, flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <View style={{ flexGrow: 1, flexBasis: 300 }}>
          <T accessibilityRole="header" size={18} lineHeight={26} weight={600}>
            {view.from.name} ↔ {view.to.name}
          </T>
          <T size={13} color={color.textTertiary}>
            Secure thread for this patient only · {participants} participant{participants === 1 ? '' : 's'}
          </T>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="lock" size={14} color={color.textTertiary} />
          <T size={13} color={color.textTertiary}>
            Messages are logged in Activity
          </T>
        </View>
      </View>
      {wide ? (
        <ScrollView ref={scroll} style={{ flex: 1 }} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}>
          {list}
        </ScrollView>
      ) : (
        list
      )}
      <Composer view={view} quote={quote} onClearQuote={onClearQuote} items={wide ? [] : items} onAsk={onAsk} />
    </View>
  );
}

type Mic = 'idle' | 'recording' | 'processing';

function Composer({ view, quote, onClearQuote, items, onAsk }: { view: HandoffView; quote: AskItem | null; onClearQuote: () => void; items: AskItem[]; onAsk: (id: string) => void }) {
  const [text, setText] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [mic, setMic] = useState<Mic>('idle');
  const [secs, setSecs] = useState(0);
  const [fromVoice, setFromVoice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [railOpen, setRailOpen] = useState(false);

  useEffect(() => {
    if (mic !== 'recording') return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [mic]);

  const startRec = () => {
    setSecs(0);
    setMic('recording');
  };
  // Demo: the transcript lands in the composer for review. Nothing is sent without pressing Send.
  const stopRec = async () => {
    setMic('processing');
    try {
      const draft = await transcribeVoiceNote({ patientId: view.patient.id, durationSec: secs });
      setText(draft.transcript);
      setFromVoice(true);
    } finally {
      setMic('idle');
    }
  };

  const send = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      await sendMessage(view.handoff.id, { text, urgent, quote: quote ? { kind: quote.kind, text: quote.text, page: quote.page } : undefined });
      setText('');
      setUrgent(false);
      setFromVoice(false);
      onClearQuote();
    } finally {
      setBusy(false);
    }
  };

  const micLabel = mic === 'recording' ? `Recording ${fmtClock(secs)} · tap to stop` : mic === 'processing' ? 'Transcribing…' : 'Type or record';

  return (
    <View style={{ backgroundColor: color.bgSurface, borderTopWidth: 1, borderTopColor: color.borderDefault, paddingTop: 14, paddingHorizontal: 20, paddingBottom: 16, gap: 10, shadowColor: '#0F1B2A', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: -4 } }}>
      {items.length ? (
        // Narrow layouts: brief items fold into the composer so "Ask" lands right next to the text box.
        <View style={{ gap: 8 }}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: railOpen }} onPress={() => setRailOpen((o) => !o)} style={{ minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="reply-quote" size={16} color={color.accent} />
            <T size={14} weight={600} color={color.accent} style={{ flex: 1 }}>
              Ask about a brief item ({items.length})
            </T>
            <Icon name={railOpen ? 'chevron-up' : 'chevron-down'} size={16} color={color.accent} />
          </Pressable>
          {railOpen ? (
            <BriefRail
              items={items}
              quoteId={quote?.id ?? null}
              onAsk={(i) => {
                onAsk(i);
                setRailOpen(false);
              }}
              onSource={() => router.navigate(`/aftercare/${view.handoff.id}?tab=packet` as never)}
              bare
            />
          ) : null}
        </View>
      ) : null}
      {urgent ? <EmergencyBanner onCall={false} extra="This thread is not monitored as an emergency line." /> : null}
      {quote ? <QuoteChip kind="Asking about" text={quote.text} page={quote.page} onClear={onClearQuote} /> : null}
      {fromVoice ? <AiLabel text="Transcript · AI-generated, review before sending" /> : null}
      <TextInput
        accessibilityLabel={`Message to ${view.from.name}`}
        value={text}
        onChangeText={(t) => {
          setText(t);
          if (!t) setFromVoice(false);
        }}
        placeholder={quote ? 'Write a question about this item…' : `Message ${view.from.name}…`}
        placeholderTextColor={color.textTertiary}
        multiline
        numberOfLines={2}
        style={[
          { minHeight: 64, fontFamily: font.regular, fontSize: 16, lineHeight: 24, color: color.textPrimary, borderWidth: 1, borderColor: color.borderStrong, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 12, textAlignVertical: 'top', backgroundColor: color.bgSurface },
          Platform.OS === 'web' ? ({ outlineColor: color.accent } as object) : null,
        ]}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: urgent }}
          accessibilityHint="Shows the emergency line. Urgent messages notify the hospital team right away."
          onPress={() => setUrgent((u) => !u)}
          style={{ height: 40, paddingHorizontal: 12, borderWidth: 1, borderColor: urgent ? color.critical : color.borderStrong, backgroundColor: urgent ? color.criticalBg : color.bgSurface, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: 8 }}
        >
          <Checkbox checked={urgent} tint={color.critical} size={18} />
          <Icon name="flag-urgent" size={16} color={urgent ? color.critical : color.textPrimary} />
          <T size={14} weight={600} color={urgent ? color.critical : color.textPrimary}>
            Mark urgent
          </T>
        </Pressable>
        <T size={13} color={mic === 'recording' ? color.critical : color.textTertiary} style={{ marginLeft: 'auto' }}>
          {micLabel}
        </T>
        <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <PulseRing size={44} active={mic === 'recording'} />
          {mic === 'idle' ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Record voice memo" onPress={startRec} style={{ width: 44, height: 44, borderRadius: 999, borderWidth: 1, borderColor: color.accent, backgroundColor: color.bgSurface, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="mic" size={20} color={color.accent} />
            </Pressable>
          ) : mic === 'recording' ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Stop recording" onPress={stopRec} style={{ width: 44, height: 44, borderRadius: 999, backgroundColor: color.critical, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="stop" size={18} color="#FFFFFF" fill="#FFFFFF" />
            </Pressable>
          ) : (
            <View accessibilityRole="progressbar" accessibilityLabel="Transcribing voice memo" style={{ width: 44, height: 44, borderRadius: 999, borderWidth: 2, borderColor: color.borderStrong, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="refresh" size={18} color={color.textSecondary} />
            </View>
          )}
        </View>
        <Button icon="send" label="Send" disabled={!text.trim() || busy} onPress={send} style={{ height: 44, paddingHorizontal: 18 }} />
      </View>
    </View>
  );
}

function BriefRail({ items, quoteId, onAsk, onSource, bare }: { items: AskItem[]; quoteId: string | null; onAsk: (id: string) => void; onSource: () => void; bare?: boolean }) {
  return (
    <View accessibilityLabel="Brief items" style={bare ? { gap: 12 } : { backgroundColor: color.bgSurface, borderWidth: 1, borderColor: color.borderDefault, borderRadius: radius.lg, padding: 16, gap: 12 }}>
      <View style={{ gap: 6 }}>
        {bare ? null : (
          <T accessibilityRole="header" size={17} lineHeight={24} weight={600}>
            Brief items
          </T>
        )}
        <AiLabel />
      </View>
      <View style={{ gap: 8 }}>
        {items.map((it) => {
          const on = it.id === quoteId;
          return (
            <View key={it.id} style={{ borderWidth: 1, borderColor: on ? color.accent : color.borderSubtle, backgroundColor: on ? color.accentSelectedBg : color.bgSurface, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {it.kind === 'unclear' ? <UnclearBadge /> : <PriorityBadge priority={it.priority ?? 'info'} />}
                <View style={{ marginLeft: 'auto' }}>
                  <SourceLink page={it.page} short onPress={onSource} />
                </View>
              </View>
              <T size={14} lineHeight={20} weight={600}>
                {it.text}
              </T>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={on ? `Quoted in reply: ${it.text}` : `Ask about this item: ${it.text}`}
                onPress={() => onAsk(it.id)}
                style={{ alignSelf: 'flex-start', height: 36, paddingHorizontal: 10, borderRadius: radius.md, borderWidth: 1, borderColor: on ? color.accent : color.deliveredBorder, backgroundColor: color.bgSurface, flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                <Icon name={on ? 'check' : 'reply-quote'} size={14} color={color.accent} />
                <T size={13} weight={600} color={color.accent}>
                  {on ? 'Quoted in reply' : 'Ask about this item'}
                </T>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

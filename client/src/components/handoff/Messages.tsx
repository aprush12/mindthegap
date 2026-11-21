import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, View } from 'react-native';
import type { ActivityView, ThreadEntry } from '../../lib/api';
import { fmtClock, fmtShort, fmtTime, fmtTimeSec } from '../../lib/clock';
import { color, radius } from '../../theme/tokens';
import { Icon, type IconName } from '../Icon';
import { AiLabel, Avatar, DataChip, UrgentTag } from '../ui/Badges';
import { LinkButton } from '../ui/Button';
import { B, Mono, T } from '../ui/Text';
import { EmergencyBanner } from './Banners';

const WAVE = [10, 16, 22, 14, 28, 34, 20, 12, 26, 36, 30, 18, 24, 32, 38, 28, 16, 12, 22, 30, 36, 26, 18, 14, 20, 28, 34, 24, 16, 10, 18, 26, 32, 22, 14, 20, 28, 24, 16, 12, 18, 22, 14, 10, 16, 12, 8, 6];

export function Waveform({ played = 0, bars = 48, height = 40, playedColor = color.accent, idleColor = color.waveIdle, width = 3 }: { played?: number; bars?: number; height?: number; playedColor?: string; idleColor?: string; width?: number }) {
  return (
    <View aria-hidden style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 3, height, overflow: 'hidden' }}>
      {WAVE.slice(0, bars).map((h, i) => (
        <View key={i} style={{ width, height: Math.min(h, height), borderRadius: 2, backgroundColor: i < played ? playedColor : idleColor }} />
      ))}
    </View>
  );
}

/** Simulated playback (no audio file in the demo). */
export function usePlayback(durationSec: number) {
  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setPos((p) => (p + 1 >= durationSec ? (setPlaying(false), durationSec) : p + 1)), 1000);
    return () => clearInterval(t);
  }, [playing, durationSec]);
  return { pos, playing, toggle: () => (pos >= durationSec ? (setPos(0), setPlaying(true)) : setPlaying((p) => !p)) };
}

/**
 * C-08 · Voice memo bubble. Audio first, then the transcript, then structured chips.
 * Transcript and chips are AI output and say so. Urgent memos carry the flag and the emergency line.
 */
export function VoiceMemoBubble({ msg, onBriefMatch, phone }: { msg: ThreadEntry; onBriefMatch?: () => void; phone?: boolean }) {
  const v = msg.voice!;
  const { pos, playing, toggle } = usePlayback(v.durationSec);
  const played = Math.round((pos / v.durationSec) * 48);
  return (
    <View style={{ gap: 8 }}>
      <BubbleHeader msg={msg} phone={phone} />
      {msg.urgent ? <EmergencyBanner compact={phone} onCall={!phone} /> : null}
      <View style={{ backgroundColor: color.bgSurface, borderWidth: 1, borderColor: color.borderDefault, borderRadius: 16, borderTopLeftRadius: 4, padding: phone ? 14 : 16, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${playing ? 'Pause' : 'Play'} voice memo, ${v.durationSec} seconds`} onPress={toggle} style={{ width: 44, height: 44, borderRadius: 999, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={playing ? 'pause' : 'play'} size={20} color="#FFFFFF" fill={playing ? 'none' : '#FFFFFF'} strokeWidth={2} />
          </Pressable>
          <Waveform played={played} bars={phone ? 30 : 48} />
          <T size={14} mono color={color.textSecondary}>
            {fmtClock(pos)} / {fmtClock(v.durationSec)}
          </T>
        </View>
        <View style={{ borderTopWidth: 1, borderTopColor: color.borderSubtle, paddingTop: 12, gap: 8 }}>
          <AiLabel text={phone ? 'AI-generated, verify against source audio' : 'Transcript · AI-generated, verify against source audio'} />
          <T size={16} lineHeight={24}>
            "{v.transcript}"
          </T>
        </View>
        {v.chips.length ? (
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {v.chips.map((c) => (
              <DataChip key={c.label} label={c.label} value={c.value} tone={c.tone} />
            ))}
          </View>
        ) : null}
        {v.briefMatch ? <LinkButton label={`Matches brief warning sign: ${v.briefMatch.text} · page ${v.briefMatch.page}`} icon="source" onPress={onBriefMatch} underline={false} /> : null}
      </View>
    </View>
  );
}

function BubbleHeader({ msg, phone }: { msg: ThreadEntry; phone?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <Avatar initials={msg.author.initials} size={28} tone={msg.author.orgId === 'oakvalley' ? 'accent' : 'neutral'} />
      <T size={13} color={color.textSecondary}>
        <B color={color.textPrimary}>{phone ? msg.author.name.replace(' (demo)', '') : msg.author.name}</B>
        {phone ? '' : ` · ${msg.org.short}`} · <Mono>{fmtTime(msg.at)}</Mono>
      </T>
      {msg.urgent ? <UrgentTag /> : null}
      {msg.kind === 'update' ? (
        <T size={12} weight={600} color={color.textTertiary}>
          Patient update
        </T>
      ) : null}
    </View>
  );
}

export function TextBubble({ msg, mine, phone }: { msg: ThreadEntry; mine?: boolean; phone?: boolean }) {
  return (
    <View style={{ gap: 8, alignItems: mine ? 'flex-end' : 'flex-start' }}>
      <BubbleHeader msg={msg} phone={phone} />
      {msg.urgent ? <EmergencyBanner compact={phone} onCall={false} /> : null}
      <View style={{ maxWidth: 640, backgroundColor: mine ? color.accentSubtle : color.bgSurface, borderWidth: 1, borderColor: mine ? color.deliveredBorder : color.borderDefault, borderRadius: 16, borderTopLeftRadius: mine ? 16 : 4, borderTopRightRadius: mine ? 4 : 16, padding: 14, gap: 10 }}>
        {msg.quote ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: mine ? color.bgSurface : color.accentSubtle, borderRadius: radius.md, paddingVertical: 6, paddingHorizontal: 10 }}>
            <Icon name="reply-quote" size={14} color={color.accent} />
            <T size={13} style={{ flexShrink: 1 }}>
              {msg.quote.kind === 'unclear' ? <B>Unclear</B> : null}
              {msg.quote.kind === 'unclear' ? ' · ' : ''}
              {msg.quote.text}
              {msg.quote.page ? ` · p.${msg.quote.page}` : ''}
            </T>
          </View>
        ) : null}
        <T size={15} lineHeight={22}>
          {msg.text}
        </T>
      </View>
      {msg.status === 'queued' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="session-clock" size={14} color={color.important} />
          <T size={13} color={color.important}>
            Not sent yet · sends when online
          </T>
        </View>
      ) : null}
    </View>
  );
}

/** System event row in the thread (handoff sent, acknowledged). */
export function SystemEvent({ msg }: { msg: ThreadEntry }) {
  const ack = /^Acknowledged/.test(msg.text ?? '');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 4 }}>
      <Icon name={ack ? 'check-circle' : 'send'} size={14} color={ack ? color.success : color.textTertiary} />
      <T size={13} color={ack ? color.success : color.textTertiary} weight={ack ? 600 : 400} align="center">
        {msg.text} · <Mono>{fmtTime(msg.at)}</Mono>
      </T>
    </View>
  );
}

export function ThreadMessageView({ msg, mine, phone, onBriefMatch }: { msg: ThreadEntry; mine?: boolean; phone?: boolean; onBriefMatch?: () => void }) {
  if (msg.authorId === 'system') return <SystemEvent msg={msg} />;
  if (msg.voice) return <VoiceMemoBubble msg={msg} phone={phone} onBriefMatch={onBriefMatch} />;
  return <TextBubble msg={msg} mine={mine} phone={phone} />;
}

const ACTION: Record<ActivityView['action'], { label: string; icon: IconName; tone?: string }> = {
  sent: { label: 'Sent', icon: 'send' },
  delivered: { label: 'Delivered', icon: 'inbox' },
  opened: { label: 'Viewed', icon: 'eye' },
  reviewed_item: { label: 'Reviewed item', icon: 'check' },
  acknowledged: { label: 'Acknowledged', icon: 'check-circle', tone: color.success },
  revealed_sensitive: { label: 'Revealed sensitive', icon: 'eye' },
  downloaded: { label: 'Downloaded PDF', icon: 'download' },
  viewed_source: { label: 'Viewed source', icon: 'source' },
  messaged: { label: 'Message', icon: 'message' },
  voice_note: { label: 'Voice memo', icon: 'mic' },
  escalated: { label: 'Escalated', icon: 'alarm', tone: color.critical },
  brief_generated: { label: 'Brief generated', icon: 'sparkle' },
  brief_approved: { label: 'Brief approved', icon: 'shield-check' },
};
export const activityActionLabel = (a: ActivityView['action']) => ACTION[a].label;

/** C-15 · Audit log row: time, named person, organization, action, what it touched. Privacy actions get a lock. */
export function AuditRow({ ev, isMe, narrow }: { ev: ActivityView; isMe?: boolean; narrow?: boolean }) {
  const a = ACTION[ev.action];
  const actionCell = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Icon name={ev.privacy ? 'lock' : a.icon} size={14} color={a.tone ?? color.textSecondary} />
      <T size={14} weight={600} color={a.tone ?? color.textPrimary}>
        {a.label}
      </T>
    </View>
  );
  if (narrow) {
    return (
      <View style={{ paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: color.borderSubtle, gap: 4 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          {actionCell}
          <T size={13} mono color={color.textTertiary}>
            {fmtShort(ev.at)}
          </T>
        </View>
        <T size={14} color={color.textSecondary}>
          {ev.actor.name}
          {isMe ? ' (you)' : ''} · {ev.org.short}
        </T>
        <T size={14}>{ev.detail}</T>
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: color.borderSubtle, gap: 16 }}>
      <T size={13} mono color={color.textSecondary} style={{ width: 130 }}>
        {fmtShort(ev.at).slice(0, 5)} {fmtTimeSec(ev.at)}
      </T>
      <View style={{ width: 220 }}>
        <T size={14} weight={600}>
          {ev.actor.name}
          {isMe ? <T size={12} weight={600} color={color.accent}>  You</T> : null}
        </T>
        <T size={13} color={color.textTertiary}>
          {ev.actor.role}
        </T>
      </View>
      <T size={14} color={color.textSecondary} style={{ width: 200 }}>
        {ev.org.name}
      </T>
      <View style={{ width: 180 }}>{actionCell}</View>
      <T size={14} style={{ flex: 1 }}>
        {ev.detail}
      </T>
    </View>
  );
}

/** Pulse ring for the recording mic (the only looping motion; skipped with reduced motion). */
export function PulseRing({ size, tint = color.critical, active }: { size: number; tint?: string; active: boolean }) {
  const a = useRef(new Animated.Value(0)).current;
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {});
  }, []);
  useEffect(() => {
    if (!active || reduce) return;
    const loop = Animated.loop(Animated.timing(a, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [active, reduce, a]);
  if (!active || reduce) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', width: size, height: size, borderRadius: size, backgroundColor: tint, opacity: a.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }), transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }] }}
    />
  );
}

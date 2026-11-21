import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { AckConfirmSheet } from '../../../components/handoff/Dialogs';
import { IdentityBannerPhone } from '../../../components/handoff/IdentityBanner';
import { Icon } from '../../../components/Icon';
import { PhoneTabBar } from '../../../components/layout/Phone';
import { PhoneCriticalCard, PhoneItemCard, PhoneUnclearCard } from '../../../components/phone/BriefCards';
import { MiniPill, NavIconButton, PhoneNavBar, PhoneSegmented, goBack } from '../../../components/phone/Parts';
import { AiLabel } from '../../../components/ui/Badges';
import { Button } from '../../../components/ui/Button';
import { DemoWatermark, ErrorState, Loading } from '../../../components/ui/States';
import { B, Mono, T } from '../../../components/ui/Text';
import { acknowledgeHandoff, getBrief, getHandoff, getUser, isRevealed, revealSensitive, setCriticalReviewed, sourceFor } from '../../../lib/api';
import { useQuery } from '../../../lib/api/useQuery';
import { fmtShort } from '../../../lib/clock';
import { color, statusStyle } from '../../../theme/tokens';

/**
 * iPhone brief (design PhoneBrief, stages before / confirm / after). Same rules as the web view:
 * every AI item names its source page, and Acknowledge stays disabled until every critical item
 * is checked. Review state is shared with the web view through the data layer.
 */
export default function PhoneBriefScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: view, loading } = useQuery(() => getHandoff(id), [id]);
  const { data: brief, loading: briefLoading, reload } = useQuery(() => getBrief(id), [id]);
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);

  const critical = useMemo(() => (brief ? brief.groups.flatMap((g) => g.items.map((i) => ({ ...i, group: g }))).filter((i) => i.priority === 'critical') : []), [brief]);

  if (loading || briefLoading) return <Loading />;
  if (!view) return <ErrorState title="Handoff not found" body="This handoff doesn't exist or you don't have access to it." />;

  const h = view.handoff;
  const acked = h.status === 'acknowledged';
  const reviewedN = critical.filter((c) => h.reviewedCriticalIds.includes(c.id)).length;
  const total = critical.length;
  const left = total - reviewedN;
  const ready = left === 0;
  const st = acked ? statusStyle.acknowledged : statusStyle[h.status];
  const openSource = (sourceId: string) => router.push(`/m/pdf/${h.id}?source=${sourceId}` as never);
  const others = brief ? brief.groups.flatMap((g) => g.items).filter((i) => i.priority !== 'critical') : [];
  const restrictNote = brief?.groups.find((g) => g.id === 'restrict' && !g.items.length)?.note;

  return (
    <View style={{ flex: 1, backgroundColor: color.bgCanvas }}>
      {/* Pinned header: patient name + DOB never scroll away. */}
      <View style={{ backgroundColor: color.bgCanvas, borderBottomWidth: 1, borderBottomColor: color.borderDefault, paddingBottom: 10, gap: 8, zIndex: 10 }}>
        <PhoneNavBar backLabel="Inbox" onBack={() => goBack('/m/inbox')} title="Handoff" right={<NavIconButton icon="file-text" label="Open full discharge packet" onPress={() => router.push(`/m/pdf/${h.id}` as never)} />} />
        <View style={{ marginHorizontal: 12 }}>
          <IdentityBannerPhone name={view.patient.name} initials={view.patient.initials} dob={view.patient.dob} age={view.patient.ageYears} style={{ paddingRight: 100 }} />
          <View style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }}>
            <MiniPill icon={st.icon} label={acked ? 'Acked' : h.status === 'overdue' ? 'Overdue' : st.label} fg={st.fg} bg={st.bg} border={st.border} />
          </View>
        </View>
        <PhoneSegmented
          label="Handoff sections"
          style={{ marginHorizontal: 12 }}
          value="brief"
          onChange={(k) => (k === 'packet' ? router.push(`/m/pdf/${h.id}` as never) : k === 'thread' ? router.push(`/m/thread/${h.id}` as never) : undefined)}
          options={[
            { key: 'brief', label: 'Brief' },
            { key: 'packet', label: 'Packet' },
            { key: 'thread', label: 'Thread' },
          ]}
        />
      </View>

      {!brief ? (
        // A summary is never shown without its source.
        <View style={{ padding: 16 }}>
          <ErrorState title="Couldn't load the discharge packet" body="The brief is hidden until its source loads. Call the hospital before acting on this discharge." code="Error · code PDF-503" onRetry={reload} />
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 14, paddingHorizontal: 12, paddingBottom: 24, gap: 14 }}>
          <View style={{ gap: 8, paddingHorizontal: 4 }}>
            <AiLabel />
            <T size={15} lineHeight={21} color={color.textSecondary}>
              <B color={color.textPrimary}>Brief is a summary.</B> The full discharge packet is the source of truth.{' '}
              <T size={15} weight={600} color={color.accent} style={{ textDecorationLine: 'underline' }} onPress={() => router.push(`/m/pdf/${h.id}` as never)} accessibilityRole="link">
                Open packet
              </T>
            </T>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, paddingHorizontal: 4 }}>
            <Icon name="alert-triangle" size={20} color={color.critical} strokeWidth={2} />
            <T accessibilityRole="header" size={20} lineHeight={26} weight={700}>
              Critical · check each one
            </T>
          </View>
          {critical.map((it) => {
            const on = h.reviewedCriticalIds.includes(it.id);
            return (
              <PhoneCriticalCard
                key={it.id}
                item={it}
                kind={it.kind ?? it.group.title}
                source={sourceFor(brief, it.sourceId)}
                checked={on}
                locked={acked}
                onToggle={() => setCriticalReviewed(h.id, it.id, !on)}
                onViewSource={() => openSource(it.sourceId)}
              />
            );
          })}

          {others.length ? (
            <T accessibilityRole="header" size={20} lineHeight={26} weight={700} style={{ marginTop: 8, paddingHorizontal: 4 }}>
              Important
            </T>
          ) : null}
          {others.map((it) => {
            const src = sourceFor(brief, it.sourceId);
            return <PhoneItemCard key={it.id} item={it} source={src} group={src.tag} onViewSource={() => openSource(it.sourceId)} />;
          })}

          {brief.unclear.length ? (
            <T accessibilityRole="header" size={20} lineHeight={26} weight={700} style={{ marginTop: 8, paddingHorizontal: 4 }}>
              Unclear / missing
            </T>
          ) : null}
          {brief.unclear.map((u) => (
            <PhoneUnclearCard key={u.id} text={u.text} source={sourceFor(brief, u.sourceId)} onViewSource={() => openSource(u.sourceId)} onAsk={() => router.push(`/m/thread/${h.id}?ask=${u.id}` as never)} />
          ))}

          {brief.sensitive.map((s) => {
            const shown = isRevealed(h.id, s.id);
            return (
              <View key={s.id} style={{ backgroundColor: color.bgSurface, borderWidth: 1, borderColor: color.borderDefault, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Icon name={shown ? 'eye' : 'eye-off'} size={22} color={color.textSecondary} />
                  <View style={{ flex: 1 }}>
                    <T size={17} weight={600}>
                      {s.title}
                    </T>
                    <T size={15} color={color.textTertiary}>
                      {shown ? 'Revealed · logged in Activity' : 'Sensitive, tap to reveal · logged'}
                    </T>
                  </View>
                  <Button variant="secondary" size="md" fontSize={16} style={{ height: 44 }} label={shown ? 'Hide' : 'Reveal'} onPress={() => revealSensitive(h.id, s.id, !shown)} accessibilityHint={shown ? undefined : 'Revealing is recorded in the activity log'} />
                </View>
                {shown ? (
                  <T size={16} lineHeight={22} color={color.textSecondary} style={{ borderTopWidth: 1, borderTopColor: color.borderSubtle, paddingTop: 10 }}>
                    {s.body}
                  </T>
                ) : null}
              </View>
            );
          })}

          <View style={{ backgroundColor: color.bgSurface, borderWidth: 1, borderColor: color.borderDefault, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, gap: 10 }}>
            {restrictNote ? (
              <T size={16} lineHeight={22} color={color.textSecondary}>
                <B color={color.textPrimary}>Restrictions:</B> none found in packet. Check the packet before assuming none apply.
              </T>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <T size={16} weight={600}>
                  {view.from.short} on-call line
                </T>
                <T size={15} mono color={color.textSecondary}>
                  {view.from.onCallNumber}
                </T>
              </View>
              {/* Placeholder: on-call number comes from the directory once wired. */}
              <Pressable accessibilityRole="button" accessibilityLabel={`Call ${view.from.short} on-call line`} onPress={() => Linking.openURL('tel:').catch(() => {})} style={{ width: 44, height: 44, borderRadius: 999, backgroundColor: color.accentSubtle, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="phone" size={20} color={color.accent} />
              </Pressable>
            </View>
          </View>
        </ScrollView>
      )}

      {/* Sticky acknowledge panel */}
      {brief ? (
        <View style={{ backgroundColor: color.bgSurface, borderTopWidth: 1, borderTopColor: color.borderDefault, paddingTop: 10, paddingHorizontal: 16, paddingBottom: 12, gap: 8, shadowColor: '#0F1B2A', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 4 }}>
          {!acked ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <T size={15} weight={600} style={{ flex: 1 }}>
                  {reviewedN} of {total} critical items reviewed
                </T>
                <View aria-hidden style={{ flexDirection: 'row', gap: 4, width: 96 }}>
                  {critical.map((c) => (
                    <View key={c.id} style={{ height: 6, flex: 1, borderRadius: 999, backgroundColor: h.reviewedCriticalIds.includes(c.id) ? color.success : color.borderDefault }} />
                  ))}
                </View>
              </View>
              {/* Safety rule: disabled until every critical item is checked. */}
              <Button size="xl" fullWidth icon="check-circle" label={ready ? 'Acknowledge' : `Check ${left} more to acknowledge`} disabled={!ready} onPress={() => setSheet(true)} accessibilityHint={ready ? 'Opens a confirmation' : undefined} />
            </>
          ) : (
            <View accessibilityRole="summary" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 999, backgroundColor: color.success, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="check" size={20} color="#FFFFFF" strokeWidth={2.5} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <T size={17} weight={600} color={color.success}>
                  Acknowledged · {total} critical item{total === 1 ? '' : 's'}
                </T>
                <T size={15} color={color.textSecondary}>
                  {h.acknowledgedBy ? getUser(h.acknowledgedBy).name : ''} · <Mono>{fmtShort(h.acknowledgedAt)}</Mono>
                </T>
              </View>
            </View>
          )}
        </View>
      ) : null}
      <PhoneTabBar active="inbox" />

      {brief ? (
        <AckConfirmSheet
          visible={sheet}
          view={view}
          items={critical}
          sources={(sid) => sourceFor(brief, sid)}
          openUnclear={brief.unclear.filter((u) => u.open).map((u) => u.text.replace(' listed with no dose', ' dose'))}
          busy={busy}
          onCancel={() => setSheet(false)}
          onConfirm={async () => {
            // "Face ID to acknowledge" (Settings) is a placeholder: no biometric prompt is shown.
            setBusy(true);
            try {
              await acknowledgeHandoff(h.id);
              setSheet(false);
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}
      <DemoWatermark phone />
    </View>
  );
}

import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { AccessRecordedNotice } from '../../../components/handoff/Banners';
import { HandoffHeader } from '../../../components/handoff/HandoffHeader';
import { AuditRow } from '../../../components/handoff/Messages';
import { MetricTile } from '../../../components/handoff/Status';
import { AppBar, MAX_W } from '../../../components/layout/Shell';
import { Button } from '../../../components/ui/Button';
import { DemoWatermark, ErrorState, Loading } from '../../../components/ui/States';
import { T } from '../../../components/ui/Text';
import { getCurrentUser, getHandoff, logPageView, type ActivityView, type HandoffView } from '../../../lib/api';
import { ACTIVITY_CATEGORIES, activityCategory, getActivityWithHistory, type ActivityCategory } from '../../../lib/api/aftercare-extra';
import { useQuery } from '../../../lib/api/useQuery';
import { fmtShort } from '../../../lib/clock';
import { color, radius, shadow } from '../../../theme/tokens';

const parse = (iso: string) => new Date(iso.length === 16 ? `${iso}:00` : iso).getTime();
const diffMin = (a?: string, b?: string) => (a && b ? Math.round((parse(b) - parse(a)) / 60000) : undefined);
const split = (m: number) => (m < 60 ? [{ n: String(m), unit: 'min' }] : [{ n: String(Math.floor(m / 60)), unit: 'h' }, { n: String(m % 60), unit: 'min' }]);

/** Audit log for one handoff. Both organizations see the same log; opening it is itself logged. */
export default function ActivityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: view, loading } = useQuery(() => getHandoff(id), [id]);
  const { data: rows, loading: rowsLoading, error, reload } = useQuery(() => getActivityWithHistory(id), [id]);
  const { width } = useWindowDimensions();
  const pad = width < 900 ? 16 : 32;
  const narrow = width < 1100;
  const [cat, setCat] = useState<ActivityCategory>('all');
  const [exportNote, setExportNote] = useState(false);
  const logged = useRef<string | undefined>(undefined);

  // Log the page view once per handoff (guarded against double effects in dev).
  useEffect(() => {
    if (!id || logged.current === id) return;
    logged.current = id;
    logPageView(id, 'Activity tab (this view)');
  }, [id]);

  if (loading) return <Loading />;
  if (!view) return <ErrorState title="Handoff not found" body="This handoff doesn't exist or you don't have access to it." />;

  const all = rows ?? [];
  const shown = all.filter((r) => cat === 'all' || activityCategory(r.action) === cat);
  const me = getCurrentUser();

  return (
    <View style={{ flex: 1, backgroundColor: color.bgCanvas }}>
      <AppBar side="aftercare" />
      <View style={[{ backgroundColor: color.bgCanvas, borderBottomWidth: 1, borderBottomColor: color.borderDefault, zIndex: 10 }, shadow.banner]}>
        <View style={{ maxWidth: MAX_W, width: '100%', alignSelf: 'center', paddingHorizontal: pad, paddingTop: 12 }}>
          <HandoffHeader view={view} tab="activity" />
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 64 }}>
        <View style={{ maxWidth: MAX_W, width: '100%', alignSelf: 'center', paddingHorizontal: pad, paddingTop: 24, gap: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
            <View style={{ flexGrow: 1, flexBasis: 520, flexShrink: 1, gap: 6 }}>
              <T accessibilityRole="header" variant="title1">
                Activity
              </T>
              <T size={15} lineHeight={22} color={color.textSecondary}>
                Every view, edit, acknowledgment, download and message on this handoff, with the person and time. Both organizations see the same log.
              </T>
            </View>
            <View style={{ gap: 6, alignItems: 'flex-end' }}>
              <Button variant="secondary" icon="download" label="Export log (logged)" fontSize={14} onPress={() => setExportNote(true)} />
              {exportNote ? (
                <T size={13} color={color.textTertiary}>
                  Export isn't available in the demo.
                </T>
              ) : null}
            </View>
          </View>

          <AccessRecordedNotice text="Opening this page was logged as the top row below." />

          <Metrics view={view} rows={all} />

          <View accessibilityLabel="Audit log" style={{ backgroundColor: color.bgSurface, borderWidth: 1, borderColor: color.borderDefault, borderRadius: radius.lg, overflow: 'hidden' }}>
            <View accessibilityRole="toolbar" accessibilityLabel="Filter events" style={{ paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: color.borderDefault, flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {ACTIVITY_CATEGORIES.map((c) => {
                const n = c.key === 'all' ? all.length : all.filter((r) => activityCategory(r.action) === c.key).length;
                const on = c.key === cat;
                return (
                  <Pressable
                    key={c.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${c.label}, ${n} events`}
                    onPress={() => setCat(c.key)}
                    style={{ height: 36, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: on ? color.accent : color.borderDefault, backgroundColor: on ? color.accent : color.bgSurface, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  >
                    <T size={13} weight={600} color={on ? '#FFFFFF' : color.textPrimary}>
                      {c.label}
                    </T>
                    <T size={13} weight={500} color={on ? '#FFFFFF' : color.textPrimary} style={{ opacity: 0.85 }}>
                      {n}
                    </T>
                  </Pressable>
                );
              })}
            </View>

            {rowsLoading ? (
              <Loading label="Loading activity" />
            ) : error ? (
              <View style={{ padding: 16 }}>
                <ErrorState title="Couldn't load the activity log" body="The log is unchanged. Try again in a moment." onRetry={reload} />
              </View>
            ) : (
              <>
                {!narrow ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 16, backgroundColor: color.bgSunken, borderBottomWidth: 1, borderBottomColor: color.borderDefault }}>
                    {[
                      ['Time', 130],
                      ['Person', 220],
                      ['Organization', 200],
                      ['Action', 180],
                    ].map(([l, w]) => (
                      <T key={l} size={13} weight={600} color={color.textSecondary} style={{ width: w as number }}>
                        {l}
                      </T>
                    ))}
                    <T size={13} weight={600} color={color.textSecondary} style={{ flex: 1 }}>
                      Details
                    </T>
                  </View>
                ) : null}
                {shown.map((ev, i) => (
                  <View key={ev.id} style={{ backgroundColor: i === 0 && cat === 'all' ? color.accentSelectedBg : ev.action === 'acknowledged' ? color.successBg : color.bgSurface }}>
                    <AuditRow ev={ev} isMe={ev.actorId === me.id} narrow={narrow} />
                  </View>
                ))}
                {shown.length === 0 ? (
                  <T size={15} color={color.textSecondary} align="center" style={{ paddingVertical: 32, paddingHorizontal: 16 }}>
                    No events of this type on this handoff.
                  </T>
                ) : null}
              </>
            )}

            <View style={{ paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', gap: 12, flexWrap: 'wrap', alignItems: 'center', backgroundColor: color.bgCanvas }}>
              <T size={13} color={color.textTertiary}>
                Showing {shown.length} of {all.length} events · newest first · times in facility local time
              </T>
              <T size={13} color={color.textTertiary} style={{ marginLeft: 'auto' }}>
                Entries cannot be edited or deleted · retained per [RETENTION POLICY]
              </T>
            </View>
          </View>
        </View>
      </ScrollView>
      <DemoWatermark />
    </View>
  );
}

function Metrics({ view, rows }: { view: HandoffView; rows: ActivityView[] }) {
  const h = view.handoff;
  const delivered = h.deliveredAt ?? h.sentAt;
  const toOpen = diffMin(delivered, h.openedAt);
  const toAck = diffMin(delivered, h.acknowledgedAt);
  const msgs = rows.filter((r) => activityCategory(r.action) === 'message');
  const urgent = msgs.filter((r) => /^(Urgent|Flagged urgent)|· urgent/.test(r.detail)).length;
  const voice = msgs.filter((r) => r.action === 'voice_note').length;
  const downloads = rows.filter((r) => r.action === 'downloaded');
  const reveals = rows.filter((r) => r.action === 'revealed_sensitive');
  const privacyPeople = [...new Set([...downloads, ...reveals].map((r) => r.actor.short))];

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {toOpen !== undefined ? (
        <MetricTile label="Delivered → opened" value="" parts={split(toOpen)} target={toOpen <= 120 ? 'Within 2 h target' : 'Over 2 h target'} tone={toOpen <= 120 ? 'ok' : 'bad'} />
      ) : (
        <MetricTile label="Delivered → opened" value="Not opened" target="Target: within 2 h" tone="pending" />
      )}
      {toAck !== undefined ? (
        <MetricTile label="Delivered → acknowledged" value="" parts={split(toAck)} target={toAck <= 240 ? 'Within 4 h target' : 'Over 4 h target'} tone={toAck <= 240 ? 'ok' : 'bad'} />
      ) : h.status === 'overdue' ? (
        <MetricTile label="Delivered → acknowledged" value="Overdue" target={`Was due ${fmtShort(h.ackDueAt)} · escalated`} tone="bad" />
      ) : (
        <MetricTile label="Delivered → acknowledged" value="Pending" target={`Due by ${fmtShort(h.ackDueAt)} · 4 h target`} tone="pending" />
      )}
      <InfoTile label="Messages" value={String(msgs.length)} sub={`${urgent} urgent · ${voice} voice memo${voice === 1 ? '' : 's'}`} />
      <InfoTile label="Downloads · sensitive reveals" value={`${downloads.length} · ${reveals.length}`} sub={privacyPeople.length ? `By ${privacyPeople.join(', ')}, logged with reason` : 'None on this handoff'} />
    </View>
  );
}

/** Neutral tile (no target): same frame as MetricTile, plain sub-line. */
function InfoTile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: 200, backgroundColor: color.bgSurface, borderWidth: 1, borderColor: color.borderDefault, borderRadius: radius.lg, padding: 16, gap: 6 }}>
      <T size={13} weight={500} color={color.textSecondary}>
        {label}
      </T>
      <T size={28} lineHeight={34} weight={700}>
        {value}
      </T>
      <T size={13} color={color.textSecondary}>
        {sub}
      </T>
    </View>
  );
}

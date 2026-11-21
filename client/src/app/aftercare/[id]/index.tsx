import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { AccessRecordedNotice, EscalationBanner, SourceOfTruthNotice } from '../../../components/handoff/Banners';
import { BriefGroupHeader, BriefItemCard, UnclearItemCard } from '../../../components/handoff/BriefItems';
import { AckConfirmSheet, DownloadReasonDialog } from '../../../components/handoff/Dialogs';
import { HandoffHeader, type HandoffTab } from '../../../components/handoff/HandoffHeader';
import { HighlightLegend, PacketPage, SensitiveSectionCard } from '../../../components/handoff/Packet';
import { Icon } from '../../../components/Icon';
import { AppBar, MAX_W } from '../../../components/layout/Shell';
import { AiLabel } from '../../../components/ui/Badges';
import { Button, IconButton } from '../../../components/ui/Button';
import { Card, DemoWatermark, ErrorState, Loading, SectionTitle } from '../../../components/ui/States';
import { Mono, T } from '../../../components/ui/Text';
import { acknowledgeHandoff, getBrief, getCurrentUser, getHandoff, isRevealed, logDownload, revealSensitive, revealedAt, sendMessage, setCriticalReviewed, sourceFor, type Brief, type HandoffView } from '../../../lib/api';
import { useQuery } from '../../../lib/api/useQuery';
import { fmtFull, fmtShort } from '../../../lib/clock';
import { color, radius, shadow } from '../../../theme/tokens';

/** Aftercare handoff view: priority brief and the discharge packet side by side, then acknowledge. */
export default function HandoffBriefScreen() {
  const { id, tab: tabParam } = useLocalSearchParams<{ id: string; tab?: string }>();
  const { data: view, loading } = useQuery(() => getHandoff(id), [id]);
  const { data: brief, loading: briefLoading, reload } = useQuery(() => getBrief(id), [id]);
  const { width } = useWindowDimensions();
  const wide = width >= 1100;
  const [tab, setTab] = useState<HandoffTab>(tabParam === 'packet' ? 'packet' : 'brief');
  const [sel, setSel] = useState<string>();
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dl, setDl] = useState(false);
  const [dlDone, setDlDone] = useState<string>();
  const [sentToThread, setSentToThread] = useState(false);

  useEffect(() => {
    if (tabParam === 'packet' || tabParam === 'brief') setTab(tabParam);
  }, [tabParam]);

  if (loading || briefLoading) return <Loading />;
  if (!view) return <ErrorState title="Handoff not found" body="This handoff doesn't exist or you don't have access to it." />;

  const pad = width < 900 ? 16 : 32;
  return (
    <View style={{ flex: 1, backgroundColor: color.bgCanvas }}>
      <AppBar side="aftercare" />
      <View style={[{ backgroundColor: color.bgCanvas, borderBottomWidth: 1, borderBottomColor: color.borderDefault, zIndex: 10 }, shadow.banner]}>
        <View style={{ maxWidth: MAX_W, width: '100%', alignSelf: 'center', paddingHorizontal: pad, paddingTop: 12 }}>
          <HandoffHeader view={view} tab={tab} onTab={setTab} />
        </View>
      </View>
      {!brief ? (
        // A summary is never shown without its source.
        <View style={{ padding: pad }}>
          <ErrorState title="Couldn't load the discharge packet" body="The brief is hidden until its source loads. If this keeps happening, call the hospital before acting on this discharge." code="Error · code PDF-503" onRetry={reload} />
        </View>
      ) : (
        <Body
          view={view}
          brief={brief}
          wide={wide}
          pad={pad}
          tab={tab}
          sel={sel ?? brief.groups[0]?.items[0]?.sourceId}
          onSelect={(s) => {
            setSel(s);
            if (!wide) setTab('packet');
          }}
          onAck={() => setSheet(true)}
          onDownload={() => setDl(true)}
          dlDone={dlDone}
          sentToThread={sentToThread}
          onAsk={async (q, text, page) => {
            await sendMessage(view.handoff.id, { text: q, quote: { kind: 'unclear', text, page } });
            setSentToThread(true);
          }}
        />
      )}
      {brief ? (
        <>
          <AckConfirmSheet
            visible={sheet}
            view={view}
            items={brief.groups.flatMap((g) => g.items).filter((i) => i.priority === 'critical')}
            sources={(sid) => sourceFor(brief, sid)}
            openUnclear={brief.unclear.filter((u) => u.open).map((u) => u.text.replace(' listed with no dose', ' dose'))}
            busy={busy}
            onCancel={() => setSheet(false)}
            onConfirm={async () => {
              setBusy(true);
              try {
                await acknowledgeHandoff(view.handoff.id);
                setSheet(false);
              } finally {
                setBusy(false);
              }
            }}
          />
          <DownloadReasonDialog
            visible={dl}
            view={view}
            onCancel={() => setDl(false)}
            onDownload={async (reason) => {
              await logDownload(view.handoff.id, reason);
              setDl(false);
              setDlDone(reason);
            }}
          />
        </>
      ) : null}
      <DemoWatermark />
    </View>
  );
}

function Body(props: { view: HandoffView; brief: Brief; wide: boolean; pad: number; tab: HandoffTab; sel: string; onSelect: (sourceId: string) => void; onAck: () => void; onDownload: () => void; dlDone?: string; sentToThread: boolean; onAsk: (q: string, text: string, page: number) => void }) {
  const { wide, pad, tab } = props;
  const showBrief = wide || tab === 'brief';
  const showViewer = wide || tab === 'packet';
  return (
    <View style={{ flex: 1, flexDirection: 'row', gap: 24, maxWidth: MAX_W, width: '100%', alignSelf: 'center', paddingHorizontal: pad }}>
      {showBrief ? <BriefColumn {...props} /> : null}
      {showViewer ? (
        <View style={{ flex: wide ? 1.1 : 1, paddingVertical: 24, minWidth: 0 }}>
          <Viewer {...props} />
        </View>
      ) : null}
    </View>
  );
}

function BriefColumn({ view, brief, sel, onSelect, onAck, onAsk, sentToThread, wide }: Parameters<typeof Body>[0]) {
  const h = view.handoff;
  const acked = h.status === 'acknowledged';
  const critical = useMemo(() => brief.groups.flatMap((g) => g.items).filter((i) => i.priority === 'critical'), [brief]);
  const reviewed = critical.filter((c) => h.reviewedCriticalIds.includes(c.id));
  const total = critical.length;
  const ready = reviewed.length === total;
  const left = total - reviewed.length;
  const itemCount = brief.groups.reduce((n, g) => n + g.items.length, 0) + brief.unclear.length;
  const me = getCurrentUser();

  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <ScrollView contentContainerStyle={{ paddingVertical: 24, gap: 20 }} showsVerticalScrollIndicator={false}>
        <EscalationBanner view={view} />
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <T accessibilityRole="header" variant="title1">
              Priority brief
            </T>
            <AiLabel />
          </View>
          <T size={14} color={color.textTertiary}>
            Generated {fmtShort(brief.generatedAt)} from the {h.pageCount}-page discharge packet · {itemCount} items · {total} critical · {brief.unclear.length} unclear
          </T>
          <SourceOfTruthNotice onOpenPacket={() => onSelect(sel)} />
        </Card>

        {brief.groups.map((g) => (
          <View key={g.id} style={{ gap: 10 }}>
            <BriefGroupHeader group={g} />
            {g.items.map((it) => (
              <BriefItemCard
                key={it.id}
                item={it}
                source={sourceFor(brief, it.sourceId)}
                checked={h.reviewedCriticalIds.includes(it.id)}
                selected={wide && sel === it.sourceId}
                locked={acked}
                onToggle={() => setCriticalReviewed(h.id, it.id, !h.reviewedCriticalIds.includes(it.id))}
                onViewSource={() => onSelect(it.sourceId)}
              />
            ))}
            {g.note ? (
              <T size={14} color={color.textTertiary} style={{ paddingHorizontal: 4 }}>
                {g.note}
              </T>
            ) : null}
          </View>
        ))}

        <View style={{ gap: 10 }}>
          <SectionTitle icon="contacts" meta="From the Handoff directory, not AI">
            Contacts
          </SectionTitle>
          <Card padding={0} style={{ paddingVertical: 14, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <View style={{ flexGrow: 1, flexBasis: 240, gap: 2 }}>
              <T size={16} weight={600}>
                {view.from.name} · on-call line
              </T>
              <T size={14} color={color.textSecondary}>
                24/7 · <Mono>{view.from.onCallNumber}</Mono>
              </T>
            </View>
            <Button variant="secondary" icon="message" label="Message hospital" fontSize={14} onPress={() => router.navigate(`/aftercare/${h.id}/thread` as never)} />
          </Card>
        </View>

        {brief.sensitive.map((s) => (
          <SensitiveSectionCard key={s.id} section={s} revealed={isRevealed(h.id, s.id)} revealedAt={revealedAt(h.id, s.id)} onToggle={() => revealSensitive(h.id, s.id, !isRevealed(h.id, s.id))} />
        ))}

        {brief.unclear.length ? (
          <View style={{ gap: 10 }}>
            <SectionTitle icon="unclear" meta={`${brief.unclear.filter((u) => u.open).length} open`}>
              Unclear / missing information
            </SectionTitle>
            {brief.unclear.map((u) => {
              const src = sourceFor(brief, u.sourceId);
              return <UnclearItemCard key={u.id} item={u} source={src} selected={wide && sel === u.sourceId} onViewSource={() => onSelect(u.sourceId)} onSend={(q) => onAsk(q, u.text, src.page)} />;
            })}
            {sentToThread ? (
              <View accessibilityRole="summary" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}>
                <Icon name="check-circle" size={16} color={color.success} />
                <T size={14} color={color.success}>
                  Question sent to the thread.
                </T>
                <Button variant="tertiary" size="sm" label="Open thread" onPress={() => router.navigate(`/aftercare/${h.id}/thread` as never)} />
              </View>
            ) : null}
          </View>
        ) : null}
        <AccessRecordedNotice />
      </ScrollView>

      {/* Sticky acknowledge bar */}
      <View style={{ paddingTop: 8, paddingBottom: 16, backgroundColor: color.bgCanvas }}>
        {!acked ? (
          <View style={[{ backgroundColor: color.bgSurface, borderWidth: 1, borderColor: color.borderDefault, borderRadius: radius.lg, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' }, shadow.e1]}>
            <View style={{ flexGrow: 1, flexBasis: 240, gap: 6 }}>
              <T size={15} weight={600}>
                {ready ? `All ${total} critical items reviewed` : `Critical items reviewed: ${reviewed.length} of ${total}`}
              </T>
              <View aria-hidden style={{ flexDirection: 'row', gap: 4 }}>
                {critical.map((c) => (
                  <View key={c.id} style={{ height: 6, flex: 1, borderRadius: 999, backgroundColor: h.reviewedCriticalIds.includes(c.id) ? color.success : color.borderDefault }} />
                ))}
              </View>
            </View>
            {/* Safety rule: disabled until every critical item is checked. */}
            <Button size="lg" icon="check-circle" label="Acknowledge handoff" disabled={!ready} onPress={onAck} accessibilityHint={ready ? undefined : `Check ${left} more critical item${left === 1 ? '' : 's'} first`} />
          </View>
        ) : (
          <View accessibilityRole="summary" style={{ backgroundColor: color.successBg, borderWidth: 1, borderColor: color.successBorder, borderRadius: radius.lg, padding: 16, flexDirection: 'row', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <View style={{ width: 40, height: 40, borderRadius: 999, backgroundColor: color.success, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="check" size={20} color="#FFFFFF" strokeWidth={2.5} />
            </View>
            <View style={{ flexGrow: 1, flexBasis: 300, gap: 4 }}>
              <T size={16} weight={600} color={color.success}>
                Handoff acknowledged
              </T>
              <T size={14} lineHeight={20}>
                {me.name} · {view.to.name} · <Mono>{fmtFull(h.acknowledgedAt)}</Mono>
              </T>
              <T size={14} lineHeight={20} color={color.textSecondary}>
                Critical items confirmed: {critical.map((c) => `${sourceFor(brief, c.sourceId).tag} (p.${sourceFor(brief, c.sourceId).page})`).join(', ')}. {view.from.name} has been notified.
              </T>
              {brief.unclear.some((u) => u.open) ? (
                <T size={13} lineHeight={18} color={color.textSecondary}>
                  Still open: {brief.unclear.filter((u) => u.open).map((u) => u.text.toLowerCase()).join('; ')} (unclear item).
                </T>
              ) : null}
            </View>
            <Button variant="outlineSuccess" label="View in Activity" fontSize={14} onPress={() => router.navigate(`/aftercare/${h.id}/activity` as never)} />
          </View>
        )}
        <T nativeID="ackWhy" size={13} color={color.textTertiary} style={{ paddingTop: 8, paddingHorizontal: 4 }}>
          {acked ? 'Acknowledgment is final. Corrections go in the thread and are logged.' : ready ? 'You will confirm who, when and which items on the next step.' : `Check ${left} more critical item${left === 1 ? '' : 's'} to acknowledge this handoff.`}
        </T>
      </View>
    </View>
  );
}

function Viewer({ view, brief, sel, onSelect, onDownload, dlDone }: Parameters<typeof Body>[0]) {
  const sources = brief.sources;
  const idx = Math.max(0, sources.findIndex((s) => s.id === sel));
  const src = sources[idx];
  return (
    <View accessibilityLabel="Discharge packet viewer" style={{ backgroundColor: color.bgSurface, borderWidth: 1, borderColor: color.borderDefault, borderRadius: radius.lg, overflow: 'hidden', flex: 1 }}>
      <View style={{ paddingVertical: 10, paddingLeft: 16, paddingRight: 12, borderBottomWidth: 1, borderBottomColor: color.borderDefault, flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <View style={{ flexGrow: 1, flexBasis: 200, minWidth: 0 }}>
          <T size={14} weight={600}>
            Discharge packet · {view.from.name}
          </T>
          <T size={13} color={color.textTertiary}>
            Page {src.page} of {view.handoff.pageCount} · {src.section}
          </T>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <IconButton icon="chevron-left" label="Previous cited source" onPress={() => onSelect(sources[(idx + sources.length - 1) % sources.length].id)} />
          <T size={13} color={color.textSecondary} style={{ paddingHorizontal: 6 }}>
            Source {idx + 1} of {sources.length}
          </T>
          <IconButton icon="chevron-right" label="Next cited source" onPress={() => onSelect(sources[(idx + 1) % sources.length].id)} />
        </View>
        <Button variant="secondary" icon="download" label="Download" fontSize={14} onPress={onDownload} />
      </View>
      {dlDone ? (
        <View accessibilityRole="summary" style={{ paddingVertical: 8, paddingHorizontal: 16, backgroundColor: color.bgCanvas, borderBottomWidth: 1, borderBottomColor: color.borderDefault, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="lock" size={14} color={color.textSecondary} />
          <T size={13} color={color.textSecondary}>
            Download logged · reason: {dlDone}
          </T>
        </View>
      ) : null}
      <ScrollView style={{ flex: 1, backgroundColor: color.pdfGutter }} contentContainerStyle={{ padding: 24 }}>
        <PacketPage view={view} source={src} />
      </ScrollView>
      <View style={{ paddingVertical: 12, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: color.borderDefault }}>
        <HighlightLegend tag={src.tag} />
      </View>
    </View>
  );
}

import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { EmergencyBanner, EscalationBanner, OfflineBanner, AccessRecordedNotice } from '../components/handoff/Banners';
import { BriefItemCard, UnclearItemCard } from '../components/handoff/BriefItems';
import { IdentityBanner, IdentityBannerPhone } from '../components/handoff/IdentityBanner';
import { PacketPage, SensitiveSectionCard } from '../components/handoff/Packet';
import { MetricTile, StatusTimeline } from '../components/handoff/Status';
import { Icon } from '../components/Icon';
import { AiLabel, PriorityBadge, StatusPill } from '../components/ui/Badges';
import { Button } from '../components/ui/Button';
import { Tabs } from '../components/ui/Controls';
import { Card, DemoWatermark, EmptyState, ErrorState, Loading } from '../components/ui/States';
import { T } from '../components/ui/Text';
import { getBrief, getHandoff, getMetrics, sourceFor } from '../lib/api';
import { useQuery } from '../lib/api/useQuery';
import { color, type as typeScale, type TypeVariant } from '../theme/tokens';

const SWATCHES: [string, string][] = [
  ['bg.canvas', color.bgCanvas], ['bg.surface', color.bgSurface], ['bg.sunken', color.bgSunken], ['border.default', color.borderDefault],
  ['border.strong', color.borderStrong], ['text.primary', color.textPrimary], ['text.secondary', color.textSecondary], ['text.tertiary', color.textTertiary],
  ['accent.default', color.accent], ['accent.subtle', color.accentSubtle], ['source.highlight', color.sourceHighlight], ['critical', color.critical],
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <Card padding={32} style={{ gap: 20, borderRadius: 16 }}>
      <View style={{ gap: 6 }}>
        <T size={12} mono color={color.textTertiary}>
          {id}
        </T>
        <T accessibilityRole="header" size={22} lineHeight={30} weight={600}>
          {title}
        </T>
      </View>
      <View style={{ backgroundColor: color.bgCanvas, borderRadius: 12, padding: 24, gap: 16 }}>{children}</View>
    </Card>
  );
}

export default function DesignSystem() {
  const view = useQuery(() => getHandoff('h-ml')).data;
  const overdue = useQuery(() => getHandoff('h-ac')).data;
  const brief = useQuery(() => getBrief('h-ml')).data;
  const metrics = useQuery(getMetrics).data;
  const [checked, setChecked] = useState(false);
  const [tab, setTab] = useState<'brief' | 'packet' | 'thread' | 'activity'>('brief');
  const [revealed, setRevealed] = useState(false);
  if (!view || !brief || !overdue || !metrics) return <Loading />;
  const [apx, ibu] = brief.groups[0].items;
  const wound = brief.groups[2].items[0];
  return (
    <View style={{ flex: 1, backgroundColor: color.bgCanvas }}>
      <ScrollView contentContainerStyle={{ padding: 32, gap: 32, maxWidth: 1280, width: '100%', alignSelf: 'center' }}>
        <View style={{ gap: 12, maxWidth: 900 }}>
          <T size={14} weight={600} color={color.accent}>
            Handoff design system v0.1
          </T>
          <T size={48} lineHeight={56} weight={700} style={{ letterSpacing: -1.2 }}>
            Foundations &amp; components
          </T>
          <T size={18} lineHeight={28} color={color.textSecondary}>
            Calm, clinical and fast to scan. Every priority and status is carried by color, icon and a text label together.
          </T>
        </View>

        <Section id="F-01" title="Color tokens">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {SWATCHES.map(([n, c]) => (
              <View key={n} style={{ width: 170, gap: 6 }}>
                <View style={{ height: 40, borderRadius: 6, backgroundColor: c, borderWidth: 1, borderColor: 'rgba(15,27,42,0.16)' }} />
                <T size={13} mono>
                  {n}
                </T>
                <T size={12} mono color={color.textTertiary}>
                  {c}
                </T>
              </View>
            ))}
          </View>
        </Section>

        <Section id="F-02" title="Type scale">
          {(Object.keys(typeScale) as TypeVariant[]).map((k) => (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <T size={13} mono color={color.textSecondary} style={{ width: 120 }}>
                {k}
              </T>
              <T variant={k}>Maria Lopez (synthetic) · START apixaban</T>
            </View>
          ))}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <T size={13} mono color={color.textSecondary} style={{ width: 120 }}>
              mono
            </T>
            <T size={13} mono>
              MRN DEMO-0001 · 11/20/2026 10:15
            </T>
          </View>
        </Section>

        <Section id="C-01" title="Patient identity banner">
          <IdentityBanner view={view} onOpenPacket={() => {}} />
          <View style={{ width: 390 }}>
            <IdentityBannerPhone name={view.patient.name} initials={view.patient.initials} dob={view.patient.dob} age={view.patient.ageYears} />
          </View>
        </Section>

        <Section id="C-02 · C-03" title="Priority badge, status pill, timeline">
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            <PriorityBadge priority="critical" />
            <PriorityBadge priority="important" />
            <PriorityBadge priority="info" />
            <PriorityBadge priority="critical" size="lg" />
          </View>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            {(['sent', 'delivered', 'opened', 'acknowledged', 'overdue'] as const).map((s) => (
              <StatusPill key={s} status={s} />
            ))}
          </View>
          <StatusTimeline view={view} />
        </Section>

        <Section id="C-04 · C-05 · C-06" title="AI label, brief item card, unclear item">
          <AiLabel />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
            <View style={{ flexBasis: 420, flexGrow: 1 }}>
              <BriefItemCard item={apx} source={sourceFor(brief, apx.sourceId)} checked={checked} onToggle={() => setChecked((c) => !c)} onViewSource={() => {}} />
            </View>
            <View style={{ flexBasis: 420, flexGrow: 1 }}>
              <BriefItemCard item={ibu} source={sourceFor(brief, ibu.sourceId)} checked onToggle={() => {}} onViewSource={() => {}} />
            </View>
            <View style={{ flexBasis: 420, flexGrow: 1 }}>
              <BriefItemCard item={wound} source={sourceFor(brief, wound.sourceId)} checked={false} selected onViewSource={() => {}} />
            </View>
            <View style={{ flexBasis: 420, flexGrow: 1 }}>
              <UnclearItemCard item={brief.unclear[0]} source={sourceFor(brief, 'ins')} onViewSource={() => {}} onSend={() => {}} />
            </View>
          </View>
        </Section>

        <Section id="C-07 · C-11" title="PDF source highlight, sensitive section">
          <View style={{ backgroundColor: color.pdfGutter, padding: 24, borderRadius: 12 }}>
            <PacketPage view={view} source={sourceFor(brief, 'apx')} />
          </View>
          <SensitiveSectionCard section={brief.sensitive[0]} revealed={revealed} revealedAt="2026-11-20T11:58" onToggle={() => setRevealed((r) => !r)} />
        </Section>

        <Section id="C-12" title="Buttons and tabs">
          <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
            <Button label="Primary" />
            <Button variant="secondary" label="Secondary" />
            <Button variant="tertiary" label="Tertiary" />
            <Button disabled label="Disabled" />
            <Button variant="danger" label="Send urgent message" icon="send" />
          </View>
          <Tabs tabs={[{ key: 'brief', label: 'Brief' }, { key: 'packet', label: 'Full packet' }, { key: 'thread', label: 'Thread', count: 2 }, { key: 'activity', label: 'Activity' }]} active={tab} onChange={setTab} />
        </Section>

        <Section id="C-13 · C-14 · C-15" title="Escalation, emergency, access">
          <EscalationBanner view={view} onAction={() => {}} />
          <EscalationBanner view={overdue} onAction={() => {}} />
          <EmergencyBanner />
          <AccessRecordedNotice />
        </Section>

        <Section id="C-16" title="Metric tiles">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {metrics.map((m) => (
              <MetricTile key={m.id} {...m} />
            ))}
          </View>
        </Section>

        <Section id="C-18" title="Empty, error and offline">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
            <View style={{ flexBasis: 320, flexGrow: 1 }}>
              <EmptyState title="No handoffs waiting" body="New discharges to Oak Valley appear here as soon as the hospital sends them." actionLabel="View acknowledged handoffs" />
            </View>
            <View style={{ flexBasis: 320, flexGrow: 1 }}>
              <ErrorState title="Couldn't load the discharge packet" body="The brief is hidden until its source loads. If this keeps happening, call the hospital before acting on this discharge." code="Error · code PDF-503" onRetry={() => {}} />
            </View>
            <View style={{ flexBasis: 320, flexGrow: 1, gap: 12 }}>
              <OfflineBanner since="11:20" />
              <Button disabled label="Acknowledge handoff · offline" fullWidth />
            </View>
          </View>
        </Section>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="info" size={14} color={color.textTertiary} />
          <T size={13} color={color.textTertiary}>
            Dark mode tokens (C-21) are specified in the design but not yet implemented.
          </T>
        </View>
      </ScrollView>
      <DemoWatermark />
    </View>
  );
}

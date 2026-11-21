import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { DownloadReasonDialog } from '../../../components/handoff/Dialogs';
import { HighlightLegend, PacketPage } from '../../../components/handoff/Packet';
import { Icon } from '../../../components/Icon';
import { useBottomInset } from '../../../components/layout/Phone';
import { NavIconButton, PhoneNavBar, PhoneSheet, goBack } from '../../../components/phone/Parts';
import { DemoWatermark, ErrorState, Loading } from '../../../components/ui/States';
import { T } from '../../../components/ui/Text';
import { getBrief, getHandoff, logDownload, type Brief } from '../../../lib/api';
import { useQuery } from '../../../lib/api/useQuery';
import { color, priorityStyle, radius } from '../../../theme/tokens';

const ZOOMS = [1, 1.3, 1.6, 2];
const PAGE_W = 362; // 402pt frame minus 20pt gutters; PacketPage lays out at this width, then scales.

function priorityOf(brief: Brief, sourceId: string): { label: string; fg: string } {
  const item = brief.groups.flatMap((g) => g.items).find((i) => i.sourceId === sourceId);
  if (!item) return { label: 'Unclear', fg: color.textSecondary };
  const p = priorityStyle[item.priority];
  return { label: p.label, fg: p.fg };
}

/** iPhone packet viewer (design PhonePDF): opens at the cited page, steps through cited sources. */
export default function PhonePdfScreen() {
  const { id, source } = useLocalSearchParams<{ id: string; source?: string }>();
  const { data: view, loading } = useQuery(() => getHandoff(id), [id]);
  const { data: brief, loading: briefLoading } = useQuery(() => getBrief(id), [id]);
  const bottom = useBottomInset();
  const [idx, setIdx] = useState(0);
  const [zoom, setZoom] = useState(0);
  const [pageH, setPageH] = useState(600);
  const [jump, setJump] = useState(false);
  const [dl, setDl] = useState(false);
  const [dlDone, setDlDone] = useState<string>();
  const lastTap = useRef(0);

  useEffect(() => {
    if (!brief) return;
    const i = brief.sources.findIndex((s) => s.id === source);
    setIdx(i >= 0 ? i : 0);
  }, [brief, source]);

  if (loading || briefLoading) return <Loading />;
  if (!view) return <ErrorState title="Handoff not found" body="This handoff doesn't exist or you don't have access to it." />;
  if (!brief || !brief.sources.length) return <ErrorState title="Couldn't load the discharge packet" body="Call the hospital before acting on this discharge." code="Error · code PDF-503" />;

  const sources = brief.sources;
  const src = sources[idx] ?? sources[0];
  const s = ZOOMS[zoom];
  const step = (d: number) => setIdx((i) => (i + d + sources.length) % sources.length);
  // Double-tap the page to fit. Pinch-to-zoom needs a gesture library; +/− buttons stand in.
  const onPageTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) setZoom(0);
    lastTap.current = now;
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.pdfGutter }}>
      <View style={{ backgroundColor: color.bgCanvas, borderBottomWidth: 1, borderBottomColor: color.borderDefault, zIndex: 10 }}>
        <PhoneNavBar backLabel="Back to brief" onBack={() => goBack(`/m/brief/${view.handoff.id}`)} title="Packet" right={<NavIconButton icon="download" label="Download packet" onPress={() => setDl(true)} />} />
        {/* Patient name + DOB stay pinned above the page. */}
        <View accessibilityLabel={`Patient ${view.patient.name}, date of birth ${view.patient.dob}`} style={{ paddingTop: 6, paddingHorizontal: 16, paddingBottom: 10, flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <T size={17} weight={700}>
            {view.patient.name}
          </T>
          <T size={16} color={color.textSecondary}>
            <T size={16} color={color.textTertiary}>DOB</T> {view.patient.dob}
          </T>
        </View>
        {dlDone ? (
          <View accessibilityRole="summary" style={{ paddingVertical: 8, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: color.borderDefault, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="lock" size={14} color={color.textSecondary} />
            <T size={14} color={color.textSecondary}>
              Download logged · reason: {dlDone}
            </T>
          </View>
        ) : null}
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 64 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} scrollEnabled={s > 1}>
            <Pressable accessibilityLabel={`Page ${src.page} of ${view.handoff.pageCount}. ${src.section}. Highlighted: ${src.quote}`} onPress={onPageTap} style={{ width: PAGE_W * s, height: pageH * s }}>
              <View onLayout={(e) => setPageH(e.nativeEvent.layout.height)} style={{ width: PAGE_W, transform: [{ scale: s }], transformOrigin: 'top left' }}>
                <PacketPage view={view} source={src} phone />
              </View>
            </Pressable>
          </ScrollView>
        </ScrollView>
        <View style={{ position: 'absolute', top: 12, right: 12, gap: 8, alignItems: 'flex-end' }}>
          <View style={{ height: 32, paddingHorizontal: 10, borderRadius: 999, backgroundColor: 'rgba(15,27,42,0.82)', justifyContent: 'center' }}>
            <T size={14} weight={600} color="#FFFFFF">
              {Math.round(s * 100)}%
            </T>
          </View>
          {[
            { label: 'Zoom in', glyph: '+', on: zoom < ZOOMS.length - 1, go: () => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1)) },
            { label: 'Zoom out', glyph: '−', on: zoom > 0, go: () => setZoom((z) => Math.max(0, z - 1)) },
          ].map((b) => (
            <Pressable key={b.label} accessibilityRole="button" accessibilityLabel={b.label} accessibilityState={{ disabled: !b.on }} disabled={!b.on} onPress={b.go} style={{ width: 44, height: 44, borderRadius: radius.lg, borderWidth: 1, borderColor: color.borderDefault, backgroundColor: color.bgSurface, alignItems: 'center', justifyContent: 'center', opacity: b.on ? 1 : 0.5 }}>
              <T size={22} weight={600}>
                {b.glyph}
              </T>
            </Pressable>
          ))}
        </View>
        <View pointerEvents="none" style={{ position: 'absolute', bottom: 14, left: 0, right: 0, alignItems: 'center' }}>
          <View style={{ height: 32, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(15,27,42,0.82)', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="search" size={14} color="#FFFFFF" />
            <T size={14} color="#FFFFFF">
              Zoom with + / − · double-tap to fit
            </T>
          </View>
        </View>
      </View>

      <View style={{ backgroundColor: color.bgSurface, borderTopWidth: 1, borderTopColor: color.borderDefault, paddingTop: 10, paddingHorizontal: 12, paddingBottom: bottom, gap: 10 }}>
        <View style={{ backgroundColor: color.bgCanvas, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 }}>
          <HighlightLegend tag={src.tag} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous cited source" onPress={() => step(-1)} style={{ width: 44, height: 44, borderRadius: radius.lg, borderWidth: 1, borderColor: color.borderDefault, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="chevron-left" size={20} color={color.textPrimary} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityHint="Opens the list of pages cited by the brief" onPress={() => setJump(true)} style={{ flex: 1, height: 44, borderRadius: radius.lg, borderWidth: 1, borderColor: color.borderStrong, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <T size={16} weight={600}>
              Page {src.page} of {view.handoff.pageCount} · Jump
            </T>
            <Icon name="chevron-down" size={18} color={color.textPrimary} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Next cited source" onPress={() => step(1)} style={{ width: 44, height: 44, borderRadius: radius.lg, borderWidth: 1, borderColor: color.borderDefault, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="chevron-right" size={20} color={color.textPrimary} />
          </Pressable>
        </View>
      </View>

      <PhoneSheet visible={jump} onClose={() => setJump(false)} label="Go to page">
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T accessibilityRole="header" size={20} weight={700}>
            Go to page
          </T>
          <Pressable accessibilityRole="button" onPress={() => setJump(false)} style={{ height: 44, paddingHorizontal: 8, justifyContent: 'center' }}>
            <T size={17} weight={600} color={color.accent}>
              Done
            </T>
          </Pressable>
        </View>
        <T size={15} weight={600} color={color.textSecondary}>
          Pages cited by the brief
        </T>
        <View style={{ borderWidth: 1, borderColor: color.borderDefault, borderRadius: radius.lg, overflow: 'hidden' }}>
          {sources.map((x, k) => {
            const p = priorityOf(brief, x.id);
            return (
              <Pressable
                key={x.id}
                accessibilityRole="button"
                accessibilityState={{ selected: k === idx }}
                onPress={() => {
                  setIdx(k);
                  setJump(false);
                }}
                style={{ minHeight: 52, paddingHorizontal: 14, borderBottomWidth: k === sources.length - 1 ? 0 : 1, borderBottomColor: color.borderSubtle, backgroundColor: k === idx ? color.accentSubtle : color.bgSurface, flexDirection: 'row', alignItems: 'center', gap: 12 }}
              >
                <T size={16} mono weight={500} style={{ width: 44 }}>
                  p.{x.page}
                </T>
                <T size={16} style={{ flex: 1 }}>
                  {x.tag}
                </T>
                <T size={14} weight={600} color={p.fg}>
                  {p.label}
                </T>
              </Pressable>
            );
          })}
        </View>
      </PhoneSheet>

      <DownloadReasonDialog
        visible={dl}
        view={view}
        onCancel={() => setDl(false)}
        onDownload={async (reason) => {
          // Demo: logs the download with the reason; no file is produced.
          await logDownload(view.handoff.id, reason);
          setDl(false);
          setDlDone(reason);
        }}
      />
      <DemoWatermark phone />
    </View>
  );
}

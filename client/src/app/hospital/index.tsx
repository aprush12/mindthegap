import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, TextInput, View } from 'react-native';
import { SessionTimeoutDialog } from '../../components/handoff/Dialogs';
import { BoardColumns, BoardTable, NAME_MODE_LABEL, StatusTiles, maskName, type NameMode, type StatusFilter } from '../../components/hospital/Board';
import { LabeledSelect, ViewToggle, useSessionTimeout } from '../../components/hospital/Controls';
import { Icon } from '../../components/Icon';
import { WebPage } from '../../components/layout/Shell';
import { Button, IconButton } from '../../components/ui/Button';
import { Card, Loading } from '../../components/ui/States';
import { T } from '../../components/ui/Text';
import { listHandoffs, listOrgs } from '../../lib/api';
import { EXTRA_BOARD_ROWS, UNITS, boardRowFromView, sortBoard, type BoardRow } from '../../lib/api/hospital-extra';
import { useQuery } from '../../lib/api/useQuery';
import { fmtFull, fmtTime, nowIso } from '../../lib/clock';
import { color, font, radius } from '../../theme/tokens';

const DATE_OPTIONS = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'custom', label: 'Custom range…' },
] as const;

/** Hospital home: outgoing handoffs status board (table or board), overdue first. */
export default function HospitalHome() {
  const params = useLocalSearchParams<{ overlay?: string; nameMode?: string }>();
  const { data: live, loading } = useQuery(() => listHandoffs({ fromOrgId: 'riverside' }), []);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [q, setQ] = useState('');
  const [unit, setUnit] = useState<string>('all');
  const [org, setOrg] = useState<string>('all');
  const [date, setDate] = useState<(typeof DATE_OPTIONS)[number]['key']>('today');
  const [view, setView] = useState<'table' | 'board'>('table');
  // Minimum necessary: the admin picks how names show on the board. Demo control below.
  const [mode, setMode] = useState<NameMode>(params.nameMode === 'full' || params.nameMode === 'initials' ? params.nameMode : 'partial');
  const [notice, setNotice] = useState<string>();
  const timeout = useSessionTimeout({ onExpire: () => router.replace('/' as never) });

  useEffect(() => {
    if (params.overlay === 'timeout') timeout.preview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.overlay]);

  const all = useMemo<BoardRow[]>(() => sortBoard([...(live ?? []).map(boardRowFromView), ...EXTRA_BOARD_ROWS]), [live]);
  const receiving = listOrgs().filter((o) => o.kind !== 'hospital');
  const needle = q.trim().toLowerCase();
  const rows = all.filter(
    (r) =>
      (status === 'all' || r.status === status) &&
      (unit === 'all' || r.unit === unit) &&
      (org === 'all' || r.toOrgId === org) &&
      (!needle || `${r.first} ${r.last}`.toLowerCase().includes(needle) || r.mrn.toLowerCase().includes(needle)),
  );

  const onAction = (r: BoardRow) => {
    const who = maskName(r, mode).display;
    if (r.action === 'Call facility') return setNotice(`Calling is a placeholder in this demo. ${r.toName} on-call line: [ON-CALL NUMBER] · ask for ${r.contact}.`);
    if (r.handoffId) return router.navigate(`/hospital/review/${r.handoffId}?stage=approved` as never);
    setNotice(`Demo row: ${who} has no detail screen. Open Maria L. to see a full handoff, or start a new one.`);
  };

  if (loading && !live) return <Loading />;
  const now = nowIso();
  return (
    <WebPage side="hospital">
      <View style={{ gap: 20, paddingTop: 4, paddingBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <View style={{ flexGrow: 1, flexBasis: 400, flexShrink: 1, gap: 4 }}>
            <T accessibilityRole="header" size={28} lineHeight={36} weight={700} style={{ letterSpacing: -0.56 }}>
              Outgoing handoffs
            </T>
            <T size={15} color={color.textSecondary}>
              Riverside General (demo) · Today, {fmtFull(now).slice(0, 10)} · updated {fmtTime(now)}
            </T>
          </View>
          <Button size="lg" fontSize={15} icon="plus" label="New handoff" onPress={() => router.navigate('/hospital/new' as never)} style={{ height: 44, paddingHorizontal: 18 }} />
        </View>

        <StatusTiles rows={all} value={status} onChange={setStatus} />

        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <View style={{ flexGrow: 1, flexBasis: 280, height: 40, borderWidth: 1, borderColor: color.borderStrong, borderRadius: radius.md, backgroundColor: color.bgSurface, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 }}>
            <Icon name="search" size={16} color={color.textTertiary} />
            <TextInput
              accessibilityLabel="Search by MRN or name"
              placeholder="Search by MRN or name"
              placeholderTextColor={color.textTertiary}
              value={q}
              onChangeText={setQ}
              style={[{ flex: 1, minWidth: 0, fontFamily: font.regular, fontSize: 15, color: color.textPrimary }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
            />
          </View>
          <LabeledSelect label="Unit" value={unit} onChange={setUnit} options={[{ key: 'all', label: 'All units' }, ...UNITS.map((u) => ({ key: u, label: u }))]} />
          <LabeledSelect label="Receiving" value={org} onChange={setOrg} options={[{ key: 'all', label: 'All facilities' }, ...receiving.map((o) => ({ key: o.id, label: o.name }))]} />
          <LabeledSelect label="Date" value={date} onChange={setDate} options={DATE_OPTIONS} />
          <ViewToggle label="View" value={view} onChange={setView} options={[{ key: 'table', label: 'Table' }, { key: 'board', label: 'Board' }]} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Icon name="eye-off" size={14} color={color.textTertiary} />
          <T size={13} color={color.textTertiary} style={{ flex: 1, minWidth: 240 }}>
            Minimum necessary: names shown as {NAME_MODE_LABEL[mode]} until a handoff is opened · set by your administrator · sorted overdue first, then by due time · {rows.length} of {all.length} shown
          </T>
        </View>

        {notice ? (
          <View accessibilityRole="summary" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: color.accentSubtle, borderRadius: radius.md, paddingVertical: 8, paddingLeft: 14, paddingRight: 6 }}>
            <Icon name="info" size={16} color={color.accent} />
            <T size={14} style={{ flex: 1 }}>
              {notice}
            </T>
            <IconButton icon="x" label="Dismiss" size={32} bordered={false} bg="transparent" onPress={() => setNotice(undefined)} />
          </View>
        ) : null}

        {view === 'table' ? <BoardTable rows={rows} mode={mode} onAction={onAction} /> : <BoardColumns rows={rows} mode={mode} onAction={onAction} />}

        {/* Demo-only controls: not part of the product UI. */}
        <Card dashed padding={16} style={{ gap: 12, marginTop: 12 }}>
          <T size={13} weight={600} color={color.textTertiary}>
            Demo controls · not part of the product
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <T size={14} color={color.textSecondary}>
                Admin name setting
              </T>
              <ViewToggle label="Name display" value={mode} onChange={setMode} options={[{ key: 'partial', label: 'First + initial' }, { key: 'initials', label: 'Initials' }, { key: 'full', label: 'Full name' }]} />
            </View>
            <Button variant="secondary" size="sm" icon="session-clock" label="Preview session timeout" onPress={timeout.preview} />
            <T size={13} color={color.textTertiary}>
              Also shows after 14 min without activity.
            </T>
          </View>
        </Card>
      </View>

      <SessionTimeoutDialog visible={timeout.visible} seconds={timeout.seconds} onStay={timeout.stay} onSignOut={() => router.replace('/' as never)} />
    </WebPage>
  );
}

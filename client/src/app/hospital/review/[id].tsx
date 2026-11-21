import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { DraftIdentityBanner, ConfirmRow, StatePill } from '../../../components/hospital/Controls';
import { HospitalDownloadDialog, ReviewItemCard, ReviewViewer, UnclearReviewCard, itemEdited, type ReviewItem, type ReviewUnclear, type UnclearDecision } from '../../../components/hospital/Review';
import { Icon } from '../../../components/Icon';
import { AppBar, MAX_W } from '../../../components/layout/Shell';
import { AiLabel } from '../../../components/ui/Badges';
import { Button } from '../../../components/ui/Button';
import { Card, DemoWatermark, ErrorState, Loading } from '../../../components/ui/States';
import { B, Mono, T } from '../../../components/ui/Text';
import { approveAndSendBrief, getBrief, getHandoff, getUser, sourceFor, type Brief, type HandoffView, type SourceRef } from '../../../lib/api';
import { HOSPITAL_USER_ID, ORG_CONTACTS, PATIENT_LOCATION } from '../../../lib/api/hospital-extra';
import { useQuery } from '../../../lib/api/useQuery';
import { fmtFull, fmtTime, nowIso } from '../../../lib/clock';
import { color, radius, shadow } from '../../../theme/tokens';

const GROUPS: { id: string; title: string; empty: string }[] = [
  { id: 'meds', title: 'Medication changes', empty: 'AI found no medication changes in the packet. Add any the patient has.' },
  { id: 'warn', title: 'Warning signs', empty: 'AI found no warning signs in the packet. Add any the patient has.' },
  { id: 'wound', title: 'Wound / device care', empty: 'No items.' },
  { id: 'follow', title: 'Follow-ups and pending results', empty: 'No items.' },
  { id: 'restrict', title: 'Restrictions', empty: 'AI found no restrictions in the packet. Add any the patient has.' },
];
const RANK = { critical: 0, important: 1, info: 2 } as const;

function initialItems(brief: Brief): ReviewItem[] {
  return brief.groups.flatMap((g) =>
    g.items.map((it) => ({ id: it.id, groupId: g.id, pri: it.priority, ai: it.priority, kind: it.kind, text: it.text, page: String(sourceFor(brief, it.sourceId).page), sourceId: it.sourceId, origin: 'ai' as const, removed: false, editing: false, textEdited: false })),
  );
}

function initialUnclear(brief: Brief, approved: boolean, missing?: string): ReviewUnclear[] {
  const list: ReviewUnclear[] = brief.unclear.map((u) => ({ id: u.id, text: u.text, page: sourceFor(brief, u.sourceId).page, sourceId: u.sourceId, decision: approved ? 'question' : 'open', resolvedText: '' }));
  // "Continue without them" from a partial read adds the unread pages as an unclear item.
  if (missing) list.push({ id: 'unread', text: `Pages ${missing.replace('-', '–')} not read (scan too blurry)`, page: Number(missing.split('-')[0]), sourceId: 'unread', decision: 'open', resolvedText: '' });
  return list;
}

/** Hospital: review the AI brief against the packet, edit, decide unclear items, then approve and send. */
export default function BriefReviewScreen() {
  const { id, stage, missing } = useLocalSearchParams<{ id: string; stage?: string; missing?: string }>();
  const { data: view, loading } = useQuery(() => getHandoff(id), [id]);
  const { data: brief, loading: briefLoading } = useQuery(() => getBrief(id), [id]);
  if (loading || briefLoading) return <Loading />;
  if (!view || !brief)
    return (
      <View style={{ flex: 1, backgroundColor: color.bgCanvas }}>
        <AppBar side="hospital" />
        <View style={{ padding: 32 }}>
          <ErrorState title="Brief not found" body="This draft doesn't exist or you don't have access to it." />
        </View>
      </View>
    );
  return <Review key={`${id}:${stage ?? ''}:${missing ?? ''}`} view={view} brief={brief} startApproved={stage === 'approved'} missing={missing} />;
}

function Review({ view, brief, startApproved, missing }: { view: HandoffView; brief: Brief; startApproved: boolean; missing?: string }) {
  const { width } = useWindowDimensions();
  const wide = width >= 1100;
  const pad = width < 900 ? 16 : 32;
  const me = getUser(HOSPITAL_USER_ID);
  const h = view.handoff;
  const contact = ORG_CONTACTS[h.toOrgId]?.primary ?? view.to.short;
  const unit = PATIENT_LOCATION[view.patient.id]?.unit;

  const [items, setItems] = useState<ReviewItem[]>(() => initialItems(brief));
  const [unclear, setUnclear] = useState<ReviewUnclear[]>(() => initialUnclear(brief, startApproved, missing));
  const [sel, setSel] = useState<string>(items[0]?.id ?? '');
  const [reviewed, setReviewed] = useState(startApproved);
  const [approvedAt, setApprovedAt] = useState<string | undefined>(startApproved ? h.sentAt : undefined);
  const [busy, setBusy] = useState(false);
  const [dl, setDl] = useState(false);
  const [dlDone, setDlDone] = useState<string>();
  const approved = !!approvedAt;

  useEffect(() => {
    if (missing && !startApproved) setSel('unread');
  }, [missing, startApproved]);

  // ---------- derived ----------
  const nEdited = items.filter(itemEdited).length;
  const nAdded = items.filter((x) => x.origin === 'user' && x.text).length;
  const nRemoved = items.filter((x) => x.removed).length;
  const count = (d: UnclearDecision | UnclearDecision[]) => unclear.filter((u) => ([] as UnclearDecision[]).concat(d).includes(u.decision)).length;
  const undecided = count(['open', 'resolving']);
  const nQ = count('question');
  const nRes = count('resolved');
  const plural = (n: number, s: string) => `${n} ${s}${n === 1 ? '' : 's'}`;
  const unclearSummary = [undecided ? `${plural(undecided, 'unclear item')} open` : '', nQ ? `${plural(nQ, 'question')} left for receiver` : '', nRes ? `${plural(nRes, 'unclear item')} resolved` : ''].filter(Boolean).join(' · ');
  const changeSummary = `${nEdited} edited · ${nAdded} added · ${nRemoved} removed${unclearSummary ? ` · ${unclearSummary}` : ''}`;
  const editingAny = items.some((x) => x.editing);
  const canApprove = reviewed && !undecided && !editingAny;
  const gateText = canApprove
    ? `Approving records your name and time on the brief. ${view.to.short} is notified right away.`
    : undecided
      ? `Decide the unclear item${undecided === 1 ? '' : 's'}: resolve it or leave it as a question.`
      : editingAny
        ? 'Save or cancel the item you are editing.'
        : 'Confirm you checked every item against its source page.';

  // ---------- viewer ----------
  const cited = brief.sources;
  const selItem = items.find((x) => x.id === sel);
  const selUnclear = unclear.find((u) => u.id === sel);
  let source: SourceRef;
  if (selItem?.sourceId) {
    const s = sourceFor(brief, selItem.sourceId);
    const pg = Number(selItem.page);
    source = pg && pg !== s.page ? { ...s, page: pg, section: 'Page set by reviewer' } : s;
  } else if (selItem) {
    source = { id: selItem.id, page: Number(selItem.page) || 1, section: 'Page added by reviewer', tag: 'Added item', quote: 'Highlight appears once a source page is set.' };
  } else if (selUnclear && selUnclear.sourceId === 'unread') {
    source = { id: 'unread', page: selUnclear.page, section: 'Unreadable scan', tag: 'Not read', quote: '[Scanned image too blurry to read. Nothing on this page is in the brief.]' };
  } else {
    source = cited.find((s) => s.id === (selUnclear?.sourceId ?? sel)) ?? cited[0];
  }
  const found = cited.findIndex((s) => s.id === source.id);
  const idx = Math.max(0, found);
  const jump = (d: number) => {
    const s = cited[(idx + d + cited.length) % cited.length];
    const owner = items.find((x) => x.sourceId === s.id) ?? unclear.find((u) => u.sourceId === s.id);
    setSel(owner?.id ?? s.id);
  };

  const patch = (itemId: string, p: Partial<ReviewItem>) => setItems((xs) => xs.map((x) => (x.id === itemId ? { ...x, ...p } : x)));
  const addItem = (groupId: string) => {
    const nid = `new-${items.length + 1}`;
    setItems((xs) => [...xs, { id: nid, groupId, pri: 'important', ai: 'important', text: '', page: '', origin: 'user', removed: false, editing: true, textEdited: false }]);
    setSel(nid);
  };
  const approve = async () => {
    setBusy(true);
    try {
      await approveAndSendBrief(h.id);
      setApprovedAt(nowIso());
    } finally {
      setBusy(false);
    }
  };

  // ---------- render ----------
  const editor = (
    <View style={{ gap: 18 }}>
      <Card padding={0} style={{ paddingVertical: 18, paddingHorizontal: 20, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <T accessibilityRole="header" size={22} lineHeight={30} weight={600}>
            AI brief review
          </T>
          <AiLabel />
        </View>
        <T size={14} lineHeight={20} color={color.textSecondary}>
          Drafted {fmtTime(brief.generatedAt)} from {h.pageCount} pages. Check each item against its page, fix what's wrong, and decide every unclear item. {view.to.short} sees nothing until you approve.
        </T>
      </Card>

      {GROUPS.map((g) => {
        const its = items.filter((x) => x.groupId === g.id).sort((a, b) => RANK[a.pri] - RANK[b.pri]);
        return (
          <View key={g.id} style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4, minHeight: 36 }}>
              <T accessibilityRole="header" size={18} lineHeight={26} weight={600} style={{ flex: 1 }}>
                {g.title}
              </T>
              {!approved ? <Button variant="outlineAccent" size="sm" fontSize={13} icon="plus" label="Add item" onPress={() => addItem(g.id)} style={{ height: 36, paddingHorizontal: 10, borderColor: color.deliveredBorder }} /> : null}
            </View>
            {its.length === 0 ? (
              <T size={14} lineHeight={20} color={color.textTertiary} style={{ paddingHorizontal: 4 }}>
                {g.empty}
              </T>
            ) : null}
            {its.map((x) => (
              <ReviewItemCard
                key={x.id}
                item={x}
                selected={sel === x.id}
                locked={approved}
                onSelect={() => setSel(x.id)}
                onChange={(p) => patch(x.id, p)}
                onCancelNew={() => setItems((xs) => xs.filter((y) => y.id !== x.id))}
              />
            ))}
          </View>
        );
      })}

      {unclear.length ? (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 }}>
            <T accessibilityRole="header" size={18} lineHeight={26} weight={600} style={{ flex: 1 }}>
              Unclear / missing information
            </T>
            <T size={13} weight={600} color={undecided ? color.important : color.success}>
              {undecided ? `${undecided} need${undecided === 1 ? 's' : ''} a decision` : 'Decided'}
            </T>
          </View>
          {unclear.map((u) => (
            <UnclearReviewCard
              key={u.id}
              item={u}
              selected={sel === u.id}
              locked={approved}
              receiver={view.to.short}
              onSelect={() => setSel(u.id)}
              onDecide={(decision, resolvedText) => setUnclear((us) => us.map((x) => (x.id === u.id ? { ...x, decision, resolvedText: resolvedText ?? x.resolvedText } : x)))}
            />
          ))}
        </View>
      ) : null}
    </View>
  );

  const footer = approved ? null : (
    <View style={[{ backgroundColor: color.bgSurface, borderWidth: 1, borderColor: color.borderDefault, borderRadius: radius.lg, padding: 16, gap: 12 }, shadow.e1]}>
      <View style={{ flexDirection: 'row', gap: 16, rowGap: 4, flexWrap: 'wrap' }}>
        <T size={14} color={color.textSecondary}>
          <T size={14} color={color.textTertiary}>Reviewer</T> <B color={color.textPrimary}>{me.name}</B>
        </T>
        <T size={14} color={color.textSecondary}>
          <T size={14} color={color.textTertiary}>Sending to</T> <B color={color.textPrimary}>{view.to.name}</B> · {contact} · due {fmtTime(h.ackDueAt)}
        </T>
        <T size={14} color={color.textSecondary}>
          {changeSummary}
        </T>
      </View>
      <ConfirmRow minHeight={44} checked={reviewed} onToggle={() => setReviewed((r) => !r)} label="I checked every item against its source page" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <T size={14} color={canApprove ? color.textSecondary : color.important} style={{ flexGrow: 1, flexBasis: 260 }}>
          {gateText}
        </T>
        {/* Safety rule: nothing is sent until the reviewer confirms and every unclear item is decided. */}
        <Button size="lg" icon="shield-check" label={busy ? 'Sending…' : `Approve and send to ${view.to.short}`} disabled={!canApprove || busy} onPress={approve} style={{ paddingHorizontal: 20 }} />
      </View>
    </View>
  );

  const viewer = (
    <ReviewViewer
      view={view}
      source={source}
      index={found}
      total={cited.length}
      onPrev={() => jump(-1)}
      onNext={() => jump(1)}
      onDownload={() => setDl(true)}
      dlDone={dlDone}
      fill={wide}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: color.bgCanvas }}>
      <AppBar side="hospital" />
      {/* Pinned header: patient identity never scrolls away. */}
      <View style={{ backgroundColor: color.bgCanvas, borderBottomWidth: 1, borderBottomColor: color.borderDefault, zIndex: 10 }}>
        <View style={{ maxWidth: MAX_W, width: '100%', alignSelf: 'center', paddingHorizontal: pad, paddingVertical: 14, gap: 10 }}>
          <DraftIdentityBanner
            patient={view.patient}
            route={`${view.patient.reasonForStay} · ${unit ? `${unit} → ` : ''}${view.to.name}`}
            pill={approved ? <StatePill tone="sent" icon="send" label={`Sent ${fmtTime(approvedAt)}`} /> : <StatePill tone="draft" icon="pencil" label="Draft · awaiting your approval" />}
          />
          {approved ? (
            <View accessibilityRole="summary" style={{ backgroundColor: color.successBg, borderWidth: 1, borderColor: color.successBorder, borderRadius: radius.lg, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Icon name="shield-check" size={22} color={color.success} strokeWidth={2} />
              <T size={15} lineHeight={22} style={{ flexGrow: 1, flexBasis: 400, flexShrink: 1 }}>
                <B color={color.success}>Reviewed and approved by {me.name}</B> · <Mono>{fmtFull(approvedAt)}</Mono> · {changeSummary} · sent to {contact} at {view.to.name}
              </T>
              <T size={14} color={color.textSecondary}>
                The brief is now read-only. Corrections go in the thread.
              </T>
            </View>
          ) : null}
        </View>
      </View>

      {wide ? (
        <View style={{ flex: 1, flexDirection: 'row', gap: 24, maxWidth: MAX_W, width: '100%', alignSelf: 'center', paddingHorizontal: pad }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <ScrollView contentContainerStyle={{ paddingTop: 20, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
              {editor}
            </ScrollView>
            {footer ? <View style={{ paddingTop: 8, paddingBottom: 16 }}>{footer}</View> : null}
          </View>
          <View style={{ flex: 1.1, minWidth: 0, paddingTop: 20, paddingBottom: 16 }}>{viewer}</View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ maxWidth: MAX_W, width: '100%', alignSelf: 'center', paddingHorizontal: pad, paddingTop: 20, paddingBottom: 48, gap: 24 }}>
          {editor}
          {viewer}
          {footer}
        </ScrollView>
      )}

      <HospitalDownloadDialog
        visible={dl}
        view={view}
        userShort={me.short}
        date={fmtFull(nowIso()).slice(0, 10)}
        onCancel={() => setDl(false)}
        onDownload={(reason) => {
          // Demo: no file is produced. The real build logs the reason server-side and returns a watermarked PDF.
          setDl(false);
          setDlDone(reason);
        }}
      />
      <DemoWatermark />
    </View>
  );
}

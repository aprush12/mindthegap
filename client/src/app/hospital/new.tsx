import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, TextInput, View, type ViewStyle } from 'react-native';
import { ConfirmRow, DraftIdentityBanner, FormSelect, StatePill, StepHeading } from '../../components/hospital/Controls';
import { FlowSteps, GenerateErrorCard, GeneratingCard } from '../../components/hospital/Generate';
import { Icon } from '../../components/Icon';
import { WebPage } from '../../components/layout/Shell';
import { Button, IconButton } from '../../components/ui/Button';
import { Radio } from '../../components/ui/Controls';
import { Loading } from '../../components/ui/States';
import { B, Mono, T } from '../../components/ui/Text';
import { generateBrief, listOrgs, listPatients } from '../../lib/api';
import { ACK_WINDOWS, DEMO_PACKET, DEMO_REJECTED_FILE, LOOKALIKE_PATIENTS, ORG_CONTACTS, PATIENT_LOCATION, UNREADABLE_PAGES } from '../../lib/api/hospital-extra';
import { useQuery } from '../../lib/api/useQuery';
import { fmtTime, now, nowIso } from '../../lib/clock';
import { color, font, radius } from '../../theme/tokens';

type Stage = 'form' | 'generating' | 'error';
type Candidate = { id: string; name: string; dob: string; mrn: string; loc: string; similar: boolean };

const SECTION: ViewStyle = { backgroundColor: color.bgSurface, borderWidth: 1, borderColor: color.borderDefault, borderRadius: radius.lg, padding: 24, gap: 16 };

const pad = (n: number) => String(n).padStart(2, '0');
function dueIn(hours: number) {
  const d = new Date(now().getTime() + hours * 3600_000);
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** New handoff: packet → patient (checked against the packet) → receiver → due by → generate the AI brief. */
export default function NewHandoff() {
  const params = useLocalSearchParams<{ stage?: string }>();
  const { data: patients } = useQuery(() => listPatients(), []);
  const [stage, setStage] = useState<Stage>(params.stage === 'error' ? 'error' : 'form');
  const [packet, setPacket] = useState(params.stage === 'generating' || params.stage === 'error');
  const [rejected, setRejected] = useState(false);
  const [q, setQ] = useState('maria lop');
  const [sel, setSel] = useState('ml');
  const [confirmed, setConfirmed] = useState(params.stage === 'generating' || params.stage === 'error');
  const [org, setOrg] = useState('oakvalley');
  const [primary, setPrimary] = useState(0);
  const [backup, setBackup] = useState(0);
  const [win, setWin] = useState<(typeof ACK_WINDOWS)[number]['key']>('4');
  const [read, setRead] = useState(0);
  const run = useRef(0);

  const start = () => {
    const token = ++run.current;
    setStage('generating');
    setRead(0);
    const tick = setInterval(() => setRead((r) => (run.current === token ? Math.min(r + 1, DEMO_PACKET.pageCount - 1) : r)), 2400 / DEMO_PACKET.pageCount);
    generateBrief({ patientId: DEMO_PACKET.patientId, fileName: DEMO_PACKET.fileName, pageCount: DEMO_PACKET.pageCount })
      .then(() => {
        clearInterval(tick);
        if (run.current !== token) return;
        setRead(DEMO_PACKET.pageCount);
        // Demo: the generated draft is reviewed on the seeded handoff id.
        router.navigate('/hospital/review/h-ml' as never);
      })
      .catch(() => {
        clearInterval(tick);
        if (run.current === token) setStage('error');
      });
  };
  const stop = (next: Stage) => {
    run.current++;
    setStage(next);
  };

  useEffect(() => {
    if (params.stage === 'generating') start();
    return () => {
      run.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!patients) return <Loading />;
  const maria = patients.find((p) => p.id === DEMO_PACKET.patientId)!;
  const window = ACK_WINDOWS.find((w) => w.key === win)!;
  const due = dueIn(window.hours);
  const to = listOrgs().find((o) => o.id === org)!;

  if (stage !== 'form') {
    const loc = PATIENT_LOCATION[maria.id];
    return (
      <WebPage side="hospital">
        <View style={{ gap: 24, alignItems: 'center', marginTop: -4 }}>
          <DraftIdentityBanner style={{ alignSelf: 'stretch' }} patient={maria} route={`${loc.unit} → ${to.name} · due ${due}`} pill={<StatePill tone="draft" label="Draft · not sent" />} />
          <FlowSteps current={1} />
          {stage === 'generating' ? (
            <GeneratingCard total={DEMO_PACKET.pageCount} read={read} onCancel={() => stop('form')} onPreviewError={() => stop('error')} />
          ) : (
            <GenerateErrorCard
              total={DEMO_PACKET.pageCount}
              bad={UNREADABLE_PAGES}
              onRetry={start}
              onReplace={() => {
                setPacket(false);
                stop('form');
              }}
              onContinue={() => router.navigate(`/hospital/review/h-ml?missing=${UNREADABLE_PAGES[0]}-${UNREADABLE_PAGES[UNREADABLE_PAGES.length - 1]}` as never)}
            />
          )}
        </View>
      </WebPage>
    );
  }

  const candidates: Candidate[] = [
    ...patients.map((p) => ({ id: p.id, name: p.name, dob: p.dob, mrn: p.mrn, loc: PATIENT_LOCATION[p.id] ? `${PATIENT_LOCATION[p.id].unit}, bed ${PATIENT_LOCATION[p.id].bed}` : '—', similar: false })),
    ...LOOKALIKE_PATIENTS.map((p) => ({ ...p, similar: true })),
  ];
  const needle = q.trim().toLowerCase();
  const matches = needle ? candidates.filter((c) => c.name.toLowerCase().includes(needle) || c.mrn.toLowerCase().includes(needle) || c.dob.includes(needle)) : [];
  const selected = candidates.find((c) => c.id === sel);
  const mismatch = !!selected && sel !== DEMO_PACKET.patientId;
  const isConfirmed = confirmed && !!selected && !mismatch;
  const contacts = ORG_CONTACTS[org];
  const pick = (id: string) => {
    setSel(id);
    setConfirmed(false);
  };

  return (
    <WebPage side="hospital">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start', paddingTop: 4, paddingBottom: 16 }}>
        <View style={{ flexGrow: 999, flexShrink: 1, flexBasis: 640, minWidth: 0, gap: 20 }}>
          <View style={{ gap: 4 }}>
            <Link href={'/hospital' as never}>
              <T size={14} weight={500} color={color.accent} style={{ textDecorationLine: 'underline' }}>
                ← Outgoing handoffs
              </T>
            </Link>
            <T accessibilityRole="header" size={28} lineHeight={36} weight={700} style={{ letterSpacing: -0.56 }}>
              New handoff
            </T>
          </View>

          {/* 1 · Packet */}
          <View style={SECTION}>
            <StepHeading n={1} title="Discharge packet" done={packet} />
            <View style={{ borderWidth: 2, borderStyle: 'dashed', borderColor: color.borderStrong, borderRadius: radius.lg, backgroundColor: color.bgCanvas, padding: 28, alignItems: 'center', gap: 8 }}>
              <Icon name="upload" size={32} color={color.accent} />
              <T size={16} weight={600} align="center">
                Drag PDFs here, or{' '}
                <T size={16} weight={600} color={color.accent} style={{ textDecorationLine: 'underline' }} onPress={() => setPacket(true)}>
                  choose files
                </T>
              </T>
              <T size={14} color={color.textTertiary} align="center">
                PDF only · up to 50 MB each · no password protection
              </T>
              {!packet ? (
                <View style={{ marginTop: 8, alignItems: 'center', gap: 6 }}>
                  <Button
                    variant="outlineAccent"
                    fontSize={14}
                    icon="file-text"
                    label="Use demo packet"
                    onPress={() => {
                      setPacket(true);
                      setRejected(true);
                    }}
                  />
                  <T size={12} weight={500} color={color.textTertiary} align="center">
                    Demo placeholder: file picking isn't wired up. This adds the synthetic packet.
                  </T>
                </View>
              ) : null}
            </View>
            {packet || rejected ? (
              <View style={{ gap: 10 }}>
                {packet ? (
                  <View style={{ borderWidth: 1, borderColor: color.successBorder, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, gap: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <Icon name="file-text" size={22} color={color.textSecondary} />
                      <T size={15} weight={600} style={{ flexGrow: 1, flexBasis: 240 }}>
                        {DEMO_PACKET.fileName}
                      </T>
                      <T size={14} color={color.textSecondary}>
                        {DEMO_PACKET.sizeLabel} · {DEMO_PACKET.pageCount} pages
                      </T>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Icon name="check-circle" size={16} color={color.success} strokeWidth={2.2} />
                        <T size={14} weight={600} color={color.success}>
                          Ready
                        </T>
                      </View>
                      <IconButton icon="x" label="Remove file" size={36} onPress={() => setPacket(false)} />
                    </View>
                    <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
                      {['PDF file', 'Under 50 MB', 'Not password-protected', 'Virus scan clean'].map((c) => (
                        <View key={c} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Icon name="check" size={14} color={color.success} strokeWidth={2.4} />
                          <T size={13} color={color.success}>
                            {c}
                          </T>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
                {rejected ? (
                  <View accessibilityRole="alert" style={{ borderWidth: 1, borderColor: color.importantBorder, backgroundColor: color.importantBg, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <Icon name="lock" size={22} color={color.important} strokeWidth={2} />
                    <View style={{ flexGrow: 1, flexBasis: 300, gap: 2 }}>
                      <T size={15} weight={600} color={color.important}>
                        {DEMO_REJECTED_FILE} wasn't added: it's password-protected
                      </T>
                      <T size={14} lineHeight={20} color={color.textSecondary}>
                        The receiving facility and the AI can't open protected files. Export it again without a password, then upload.
                      </T>
                    </View>
                    <Button variant="outlineWarn" size="sm" fontSize={14} label="Dismiss" onPress={() => setRejected(false)} style={{ backgroundColor: color.bgSurface }} />
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>

          {/* 2 · Patient */}
          <View style={SECTION}>
            <StepHeading n={2} title="Patient" done={isConfirmed} />
            <View style={{ height: 44, borderWidth: 1, borderColor: color.borderStrong, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 }}>
              <Icon name="search" size={16} color={color.textTertiary} />
              <TextInput
                accessibilityLabel="Find patient"
                value={q}
                onChangeText={setQ}
                style={[{ flex: 1, minWidth: 0, fontFamily: font.regular, fontSize: 16, color: color.textPrimary }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
              />
              <T size={13} color={color.textTertiary}>
                MRN, or name + DOB
              </T>
            </View>
            {matches.length ? (
              <View accessibilityRole="radiogroup" accessibilityLabel="Matching patients" style={{ borderWidth: 1, borderColor: color.borderDefault, borderRadius: 10, overflow: 'hidden' }}>
                {matches.map((m, i) => {
                  const on = m.id === sel;
                  return (
                    <Pressable key={m.id} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => pick(m.id)} style={{ minHeight: 60, borderTopWidth: i ? 1 : 0, borderTopColor: color.borderSubtle, backgroundColor: on ? color.accentSelectedBg : color.bgSurface, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Radio selected={on} size={18} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <T size={16} weight={600}>
                          {m.name}
                        </T>
                        <T size={14} color={color.textSecondary}>
                          DOB {m.dob} · MRN {m.mrn} · {m.loc}
                        </T>
                      </View>
                      {m.similar ? (
                        <View style={{ height: 24, paddingHorizontal: 8, borderRadius: radius.sm, backgroundColor: color.importantBg, borderWidth: 1, borderColor: color.importantBorder, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Icon name="alert-circle" size={13} color={color.important} strokeWidth={2.2} />
                          <T size={12} weight={600} color={color.important}>
                            Similar name
                          </T>
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <T size={14} color={color.textTertiary}>
                No matching patients. Search by MRN, or by name and date of birth.
              </T>
            )}
            {selected ? (
              <View style={{ borderWidth: 2, borderColor: mismatch ? color.critical : isConfirmed ? color.successBorder : color.accent, borderRadius: radius.lg, padding: 16, gap: 12, backgroundColor: color.bgSurface }}>
                <T size={14} weight={600} color={color.textSecondary}>
                  Check the selected patient against the packet
                </T>
                <MatchTable a={selected} />
                {mismatch ? (
                  <View accessibilityRole="alert" style={{ backgroundColor: color.criticalBg, borderWidth: 1, borderColor: color.criticalBorder, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 12 }}>
                    <T size={14} lineHeight={20} weight={600} color={color.critical}>
                      The packet belongs to a different patient. Pick the matching patient or upload the right packet.
                    </T>
                  </View>
                ) : null}
                <ConfirmRow checked={isConfirmed} disabled={mismatch} onToggle={() => setConfirmed((c) => !c)} label={`I confirm this is ${selected.name}, DOB ${selected.dob}`} />
              </View>
            ) : null}
          </View>

          {/* 3 · Receiving organization */}
          <View style={SECTION}>
            <StepHeading n={3} title="Receiving organization" done />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
              <FormSelect
                label="Organization"
                value={org}
                onChange={(o) => {
                  setOrg(o);
                  setPrimary(0);
                  setBackup(0);
                }}
                options={listOrgs()
                  .filter((o) => o.kind !== 'hospital')
                  .map((o) => ({ key: o.id, label: o.name }))}
              />
              <FormSelect label="Primary contact" value={String(primary)} onChange={(v) => setPrimary(Number(v))} options={contacts.primaryOptions.map((c, i) => ({ key: String(i), label: c }))} />
              <FormSelect label="Backup contact for escalation" value={String(backup)} onChange={(v) => setBackup(Number(v))} options={contacts.backupOptions.map((c, i) => ({ key: String(i), label: c }))} />
            </View>
            <T size={14} color={color.textTertiary}>
              Only organizations your administrator has connected appear here.
            </T>
          </View>

          {/* 4 · Acknowledge by */}
          <View style={SECTION}>
            <StepHeading n={4} title="Acknowledge by" done />
            <View accessibilityRole="radiogroup" accessibilityLabel="Acknowledgment window" style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {ACK_WINDOWS.map((w) => {
                const on = w.key === win;
                return (
                  <Pressable key={w.key} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setWin(w.key)} style={{ height: 44, paddingHorizontal: on ? 15 : 16, borderRadius: radius.md, borderWidth: on ? 2 : 1, borderColor: on ? color.accent : color.borderDefault, backgroundColor: on ? color.accentSelectedBg : color.bgSurface, justifyContent: 'center' }}>
                    <T size={15} weight={600}>
                      {w.label}
                    </T>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ gap: 6, backgroundColor: color.bgCanvas, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 14 }}>
              <T size={15} lineHeight={22}>
                Due{' '}
                <Mono weight={500}>
                  <B>{due}</B>
                </Mono>{' '}
                if sent now ({fmtTime(nowIso())})
              </T>
              <T size={15} lineHeight={22} color={color.textSecondary}>
                If not acknowledged: reminder at due time → backup contact after 1 h → charge nurse call after 2 h.
              </T>
            </View>
          </View>
        </View>

        {/* Summary */}
        <View accessibilityLabel="Summary" style={[{ flexGrow: 1, flexShrink: 1, flexBasis: 320, minWidth: 0, backgroundColor: color.bgSurface, borderWidth: 1, borderColor: color.borderDefault, borderRadius: radius.lg, padding: 20, gap: 14 }, Platform.OS === 'web' ? ({ position: 'sticky', top: 24 } as unknown as ViewStyle) : null]}>
          <T accessibilityRole="header" variant="title3">
            Ready to generate the brief?
          </T>
          <View style={{ gap: 10 }}>
            <SummaryLine ok={packet} text={packet ? `Packet · ${DEMO_PACKET.pageCount} pages` : 'No packet added'} />
            <SummaryLine ok={isConfirmed} text={isConfirmed ? `Patient confirmed: ${selected!.name}` : 'Patient not confirmed'} />
            <SummaryLine ok text={to.name} />
            <SummaryLine ok text={`Due ${due}`} />
          </View>
          {packet && isConfirmed ? (
            <Button size="lg" fontSize={16} fullWidth icon="sparkle" label="Generate AI brief" onPress={start} />
          ) : (
            <Button size="lg" fontSize={16} fullWidth disabled label={!packet ? 'Add the packet first' : 'Confirm the patient first'} />
          )}
          <T size={14} lineHeight={20} color={color.textSecondary}>
            Nothing is sent yet. You'll review and approve the brief before {to.short} sees it.
          </T>
        </View>
      </View>
    </WebPage>
  );
}

function SummaryLine({ ok, text }: { ok: boolean; text: string }) {
  const c = ok ? color.success : color.critical;
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      <Icon name={ok ? 'check-circle' : 'alert-circle'} size={18} color={c} strokeWidth={2.2} />
      <T size={15} color={ok ? color.textPrimary : c} style={{ flex: 1 }}>
        {text}
      </T>
    </View>
  );
}

/** Selected patient vs. the identifiers printed on packet page 1. */
function MatchTable({ a }: { a: { name: string; dob: string; mrn: string } }) {
  const p = DEMO_PACKET.page1;
  const rows: [string, string, string][] = [
    ['Name', a.name.replace(' (synthetic)', ''), p.name],
    ['Date of birth', a.dob, p.dob],
    ['MRN', a.mrn, p.mrn],
  ];
  const head = { backgroundColor: color.bgSunken, paddingVertical: 8, paddingHorizontal: 12 };
  const cell = { paddingVertical: 10, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: color.borderSubtle };
  const W = [1, 1.5, 1.5, 1.15];
  return (
    <View style={{ borderWidth: 1, borderColor: color.borderSubtle, borderRadius: radius.md, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row' }}>
        {['', 'Selected patient', 'Packet page 1', 'Match'].map((h, i) => (
          <T key={i} size={14} weight={600} color={color.textSecondary} style={[head, { flex: W[i] }]}>
            {h}
          </T>
        ))}
      </View>
      {rows.map(([k, x, y]) => {
        const m = x === y;
        return (
          <View key={k} style={{ flexDirection: 'row' }}>
            <T size={14} color={color.textSecondary} style={[cell, { flex: W[0] }]}>
              {k}
            </T>
            <T size={14} weight={600} style={[cell, { flex: W[1] }]}>
              {x}
            </T>
            <T size={14} weight={600} style={[cell, { flex: W[2] }]}>
              {y}
            </T>
            <View style={[cell, { flex: W[3], flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }]}>
              {m ? <Icon name="check" size={14} color={color.success} strokeWidth={2.4} /> : <Icon name="x" size={14} color={color.critical} strokeWidth={2.4} />}
              <T size={14} weight={600} color={m ? color.success : color.critical}>
                {m ? 'Match' : 'No match'}
              </T>
            </View>
          </View>
        );
      })}
    </View>
  );
}


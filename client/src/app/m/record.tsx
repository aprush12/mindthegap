import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, TextInput, View } from 'react-native';
import { EmergencyBanner } from '../../components/handoff/Banners';
import { PatientStrip } from '../../components/handoff/IdentityBanner';
import { PulseRing, usePlayback } from '../../components/handoff/Messages';
import { Icon } from '../../components/Icon';
import { useBottomInset, useTopInset } from '../../components/layout/Phone';
import { AiLabel, Avatar, UrgentTag } from '../../components/ui/Badges';
import { Button } from '../../components/ui/Button';
import { CheckRow, Field, RadioRow, Segmented } from '../../components/ui/Controls';
import { DemoWatermark } from '../../components/ui/States';
import { B, Mono, T } from '../../components/ui/Text';
import { getOrg, getPatient, handoffForPatient, listPatients, liveTranscriptWords, sendVoiceNote, transcribeVoiceNote, type Urgency, type VoiceDraft } from '../../lib/api';
import { fmtClock, fmtTime } from '../../lib/clock';
import { useQuery } from '../../lib/api/useQuery';
import { color, font, radius } from '../../theme/tokens';

type Stage = 'recording' | 'processing' | 'review' | 'sent';
const MAX_SECS = 120;
const CATEGORIES: VoiceDraft['category'][] = ['Symptom', 'Vitals', 'Medication question', 'Wound', 'Other'];
const WAVE_SEED = [10, 18, 30, 22, 40, 52, 36, 20, 28, 46, 56, 40, 24, 34, 48, 54, 42, 30, 18, 14, 26, 38, 50, 36, 28, 22, 34, 44, 52, 38, 26, 16, 12, 8, 6, 4];

/**
 * Quick capture: record → processing → review (confirm patient) → sent.
 * Safety rule: a voice note is never sent automatically. Stopping the recording only produces a
 * draft; the user must read the transcript, confirm the patient and press Send.
 */
export default function RecordFlow() {
  const params = useLocalSearchParams<{ pt?: string; typed?: string; preview?: string }>();
  const typed = params.typed === '1';
  const [stage, setStage] = useState<Stage>(typed ? 'review' : 'recording');
  const [secs, setSecs] = useState(0);
  const [words, setWords] = useState(0);
  const [draft, setDraft] = useState<VoiceDraft>(() => ({ patientId: params.pt ?? 'ml', durationSec: 0, transcript: '', category: 'Other', symptom: '', vitals: '', urgency: 'low', destination: 'message', patientConfirmed: false, typed }));
  const [sentAt, setSentAt] = useState<string>();
  const [error, setError] = useState<string>();
  const ticker = useRef<ReturnType<typeof setInterval>>(undefined);

  // Demo shortcut: ?preview=review opens on the review step with a transcribed draft (still unconfirmed).
  useEffect(() => {
    if (params.preview !== 'review' || typed) return;
    setStage('processing');
    transcribeVoiceNote({ patientId: draft.patientId, durationSec: 14 }).then((d) => {
      setDraft({ ...d, patientId: draft.patientId, patientConfirmed: false });
      setStage('review');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Simulated recording + live transcript. Placeholder for expo-audio recording and streaming STT.
  useEffect(() => {
    if (stage !== 'recording') return;
    let tick = 0;
    ticker.current = setInterval(() => {
      tick++;
      setWords((w) => Math.min(w + 1, liveTranscriptWords.length));
      if (tick % 2 === 0) setSecs((s) => s + 1);
    }, 420);
    return () => clearInterval(ticker.current);
  }, [stage]);

  const stop = async () => {
    clearInterval(ticker.current);
    setStage('processing');
    const d = await transcribeVoiceNote({ patientId: draft.patientId, durationSec: Math.max(secs, 1) });
    // Confirmation is never carried over; the user confirms on the review screen.
    setDraft({ ...d, patientId: draft.patientId, patientConfirmed: false });
    setStage('review');
  };

  useEffect(() => {
    if (stage === 'recording' && secs >= MAX_SECS) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secs, stage]);

  const discard = () => {
    clearInterval(ticker.current);
    router.canGoBack() ? router.back() : router.replace('/m/capture' as never);
  };

  const send = async () => {
    setError(undefined);
    try {
      const m = await sendVoiceNote(draft);
      setSentAt(m.at);
      setStage('sent');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const pt = getPatient(draft.patientId);
  if (stage === 'recording') return <Recording name={pt.name} dob={pt.dob} secs={secs} text={liveTranscriptWords.slice(0, words).join(' ')} onStop={stop} onDiscard={discard} />;
  if (stage === 'processing') return <Processing name={pt.name} dob={pt.dob} secs={secs} />;
  if (stage === 'sent') return <Sent draft={draft} sentAt={sentAt} />;
  return <Review draft={draft} setDraft={setDraft} onDiscard={discard} onSend={send} error={error} />;
}

function TopBar({ left, center, right }: { left?: React.ReactNode; center?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={{ height: 44, flexDirection: 'row', alignItems: 'center', marginHorizontal: -8 }}>
      <View style={{ flex: 1, alignItems: 'flex-start' }}>{left}</View>
      {center}
      <View style={{ flex: 1, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

function TextAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ height: 44, paddingHorizontal: 8, justifyContent: 'center' }}>
      <T size={17} color={color.accent}>
        {label}
      </T>
    </Pressable>
  );
}

function Recording({ name, dob, secs, text, onStop, onDiscard }: { name: string; dob: string; secs: number; text: string; onStop: () => void; onDiscard: () => void }) {
  const top = useTopInset();
  const bottom = useBottomInset();
  const shift = (secs * 3) % WAVE_SEED.length;
  return (
    <View style={{ flex: 1, backgroundColor: color.bgSurface, paddingTop: top, paddingBottom: bottom, paddingHorizontal: 20, gap: 16 }}>
      <TopBar
        left={<TextAction label="Discard" onPress={onDiscard} />}
        center={
          <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: color.critical }} />
            <T size={17} weight={600} color={color.critical}>
              Recording
            </T>
          </View>
        }
      />
      <PatientStrip name={name} dob={dob} />
      <View style={{ flex: 1, gap: 10, minHeight: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="sparkle" size={14} color={color.textTertiary} />
          <T size={13} weight={600} color={color.textTertiary}>
            Live transcript · AI, may contain errors
          </T>
        </View>
        <T accessibilityLiveRegion="polite" size={24} lineHeight={34} weight={500} style={{ letterSpacing: -0.24 }}>
          {text}
          <T size={24} color={color.accent}>
            ▏
          </T>
        </T>
      </View>
      <View aria-hidden style={{ height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
        {WAVE_SEED.map((_, i) => (
          <View key={i} style={{ width: 4, borderRadius: 2, height: WAVE_SEED[(i + shift) % WAVE_SEED.length], backgroundColor: i > 28 ? color.borderSubtle : color.critical }} />
        ))}
      </View>
      <View style={{ alignItems: 'center', gap: 14, paddingBottom: 12 }}>
        <T size={40} mono weight={500}>
          {fmtClock(secs)}
        </T>
        <View style={{ width: 88, height: 88, alignItems: 'center', justifyContent: 'center' }}>
          <PulseRing size={88} active />
          <Pressable accessibilityRole="button" accessibilityLabel={`Stop recording, ${Math.floor(secs / 60)} minutes ${secs % 60} seconds`} onPress={onStop} style={{ width: 88, height: 88, borderRadius: 999, backgroundColor: color.critical, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: color.criticalBorder }}>
            <View style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: '#FFFFFF' }} />
          </Pressable>
        </View>
        <T size={15} color={color.textSecondary} align="center">
          Tap to stop · you'll review before anything sends
        </T>
      </View>
      <DemoWatermark phone />
    </View>
  );
}

function Processing({ name, dob, secs }: { name: string; dob: string; secs: number }) {
  const top = useTopInset();
  const Step = ({ state, label }: { state: 'done' | 'active' | 'todo'; label: string }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      {state === 'done' ? <Icon name="check-circle" size={22} color={color.success} /> : state === 'active' ? <Icon name="refresh" size={22} color={color.accent} /> : <View style={{ width: 18, height: 18, marginHorizontal: 2, borderRadius: 999, borderWidth: 2, borderStyle: 'dashed', borderColor: color.borderStrong }} />}
      <T size={17} weight={state === 'active' ? 600 : 400} color={state === 'todo' ? color.textTertiary : color.textPrimary}>
        {label}
      </T>
    </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: color.bgSurface, paddingTop: top + 44, paddingHorizontal: 24, gap: 16 }}>
      <PatientStrip name={name} dob={dob} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 }}>
        <Icon name="sparkle" size={48} color={color.accent} strokeWidth={1.5} />
        <View accessibilityRole="summary" accessibilityLiveRegion="polite" style={{ gap: 6, alignItems: 'center' }}>
          <T size={26} lineHeight={32} weight={700} align="center">
            Organizing your note…
          </T>
          <T size={16} color={color.textSecondary}>
            Nothing has been sent.
          </T>
        </View>
        <View style={{ alignSelf: 'stretch', backgroundColor: color.bgCanvas, borderRadius: radius.lg, padding: 16, gap: 14 }}>
          <Step state="done" label={`Transcript ready · ${fmtClock(Math.max(secs, 1))}`} />
          <Step state="active" label="Finding symptoms and vitals" />
          <Step state="todo" label="Suggesting urgency" />
        </View>
        <T size={15} lineHeight={21} color={color.textTertiary} align="center">
          Audio stays attached so the hospital can listen. Saved encrypted on this device until sent.
        </T>
      </View>
      <DemoWatermark phone />
    </View>
  );
}

function Review({ draft, setDraft, onDiscard, onSend, error }: { draft: VoiceDraft; setDraft: (d: VoiceDraft) => void; onDiscard: () => void; onSend: () => void; error?: string }) {
  const top = useTopInset();
  const bottom = useBottomInset();
  const [picking, setPicking] = useState(false);
  const patients = useQuery(listPatients).data ?? [];
  const { pos, playing, toggle } = usePlayback(draft.durationSec || 1);
  const pt = getPatient(draft.patientId);
  const h = handoffForPatient(draft.patientId);
  const hospital = h ? getOrg(h.fromOrgId) : undefined;
  const set = (patch: Partial<VoiceDraft>) => setDraft({ ...draft, ...patch });
  const voice = !draft.typed;
  const urgent = voice && draft.urgency === 'high';
  const canSend = draft.patientConfirmed && draft.transcript.trim().length > 0 && !!h;
  const sendLabel = draft.destination === 'message' ? (urgent ? 'Send urgent message' : 'Send message') : 'Add update';
  return (
    <View style={{ flex: 1, backgroundColor: color.bgCanvas }}>
      <View style={{ paddingTop: top, backgroundColor: color.bgCanvas, borderBottomWidth: 1, borderBottomColor: color.borderDefault, paddingHorizontal: 16 }}>
        <TopBar
          left={<TextAction label="Discard" onPress={onDiscard} />}
          center={
            <T accessibilityRole="header" size={17} weight={600}>
              Review before sending
            </T>
          }
          right={
            <View style={{ marginRight: 8, height: 24, paddingHorizontal: 8, borderRadius: radius.sm, backgroundColor: color.importantBg, borderWidth: 1, borderColor: color.importantBorder, justifyContent: 'center' }}>
              <T size={12} weight={600} color={color.important}>
                Not sent
              </T>
            </View>
          }
        />
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 14, paddingHorizontal: 12, paddingBottom: 24, gap: 14 }} keyboardShouldPersistTaps="handled">
        {/* Patient confirmation: name + DOB must be confirmed before Send enables. */}
        <View accessibilityLabel="Patient" style={{ backgroundColor: color.bgSurface, borderWidth: 2, borderColor: draft.patientConfirmed ? color.successBorder : color.accent, borderRadius: 14, padding: 14, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar initials={pt.initials} />
            <View style={{ flex: 1 }}>
              <T size={13} weight={600} color={color.textTertiary}>
                Sending about
              </T>
              <T size={19} lineHeight={24} weight={700}>
                {pt.name}
              </T>
              <T size={17} lineHeight={24} color={color.textSecondary}>
                DOB <T size={17} weight={600}>{pt.dob}</T>
              </T>
            </View>
          </View>
          <Button variant="secondary" size="lg" fontSize={15} icon="users" label={picking ? 'Keep this patient' : 'Change patient'} onPress={() => setPicking((p) => !p)} style={{ height: 44, paddingHorizontal: 12, borderRadius: 10 }} />
          {picking ? (
            <View style={{ borderWidth: 1, borderColor: color.borderDefault, borderRadius: 10, overflow: 'hidden' }}>
              {patients.map((p) => (
                <Pressable
                  key={p.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${p.name}, date of birth ${p.dob}`}
                  onPress={() => {
                    setDraft({ ...draft, patientId: p.id, patientConfirmed: false });
                    setPicking(false);
                  }}
                  style={{ minHeight: 52, paddingVertical: 6, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: color.borderSubtle, backgroundColor: p.id === draft.patientId ? color.accentSelectedBg : color.bgSurface, justifyContent: 'center' }}
                >
                  <T size={16} weight={600}>
                    {p.name}
                  </T>
                  <T size={14} color={color.textSecondary}>
                    DOB {p.dob}
                  </T>
                </Pressable>
              ))}
            </View>
          ) : null}
          <CheckRow checked={draft.patientConfirmed} onToggle={() => set({ patientConfirmed: !draft.patientConfirmed })} label="Right patient: name and DOB match" />
        </View>

        {/* Transcript (editable) */}
        <View accessibilityLabel="Note" style={{ backgroundColor: color.bgSurface, borderWidth: 1, borderColor: color.borderDefault, borderRadius: 14, padding: 14, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <T accessibilityRole="header" size={17} weight={700} style={{ flex: 1 }}>
              {voice ? 'Transcript' : 'Your note'}
            </T>
            {voice ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`${playing ? 'Pause' : 'Play'} recording, ${draft.durationSec} seconds`} onPress={toggle} style={{ height: 36, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: color.deliveredBorder, backgroundColor: color.accentSubtle, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name={playing ? 'pause' : 'play'} size={16} color={color.accent} fill={playing ? 'none' : color.accent} />
                <T size={14} weight={600} color={color.accent}>
                  {fmtClock(playing || pos ? pos : draft.durationSec)}
                </T>
              </Pressable>
            ) : null}
          </View>
          {voice ? <AiLabel text="AI-generated, verify against source audio" /> : null}
          <TextInput
            accessibilityLabel="Note text, editable"
            multiline
            value={draft.transcript}
            onChangeText={(t) => set({ transcript: t })}
            placeholder="Type your note…"
            placeholderTextColor={color.textTertiary}
            style={{ minHeight: 110, borderWidth: 1, borderColor: color.borderStrong, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontFamily: font.regular, fontSize: 17, lineHeight: 25, color: color.textPrimary, textAlignVertical: 'top' }}
          />
          <T size={14} color={color.textTertiary}>
            {voice ? 'Tap to edit. Fix any word the transcript got wrong.' : 'Write what the hospital needs to know.'}
          </T>
        </View>

        {/* AI-suggested structured details */}
        {voice ? (
          <View accessibilityLabel="Structured details" style={{ backgroundColor: color.bgSurface, borderWidth: 1, borderColor: color.borderDefault, borderRadius: 14, padding: 14, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <T accessibilityRole="header" size={17} weight={700} style={{ flex: 1 }}>
                Details
              </T>
              <AiLabel text="AI-suggested · check each" />
            </View>
            <View style={{ gap: 6 }}>
              <T size={14} weight={600} color={color.textSecondary}>
                Category
              </T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {CATEGORIES.map((c) => {
                  const on = c === draft.category;
                  return (
                    <Pressable key={c} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => set({ category: c })} style={{ height: 40, paddingHorizontal: 12, borderRadius: 999, borderWidth: on ? 2 : 1, borderStyle: on ? 'solid' : 'dashed', borderColor: on ? color.accent : color.borderStrong, backgroundColor: on ? color.accentSubtle : color.bgSurface, justifyContent: 'center' }}>
                      <T size={15} weight={on ? 600 : 400} color={on ? color.accent : color.textPrimary}>
                        {c}
                      </T>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <Field label="Symptom" big dashed value={draft.symptom} onChangeText={(t) => set({ symptom: t })} style={{ height: 48, minHeight: 48, borderRadius: 10 }} />
            <Field label="Vitals" big dashed value={draft.vitals} onChangeText={(t) => set({ vitals: t })} style={{ height: 48, minHeight: 48, borderRadius: 10 }} />
            <View style={{ gap: 6 }}>
              <T size={14} weight={600} color={color.textSecondary} style={{ paddingBottom: 6 }}>
                Urgency
              </T>
              <Segmented<Urgency> options={[{ key: 'low', label: 'Low' }, { key: 'medium', label: 'Medium' }, { key: 'high', label: 'High' }]} value={draft.urgency} onChange={(u) => set({ urgency: u })} dangerKey="high" />
            </View>
          </View>
        ) : null}

        {/* Destination */}
        <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
          <T accessibilityRole="header" size={17} weight={700} style={{ paddingHorizontal: 4, paddingBottom: 8 }}>
            Send as
          </T>
          <RadioRow selected={draft.destination === 'message'} onPress={() => set({ destination: 'message' })} label="Message hospital" sub={`${hospital?.name ?? 'Hospital'} · expects a reply`} />
          <RadioRow selected={draft.destination === 'update'} onPress={() => set({ destination: 'update' })} label="Add patient update" sub="Adds to the record · no reply needed" />
        </View>

        {urgent ? <EmergencyBanner compact /> : null}
        {!h ? (
          <T size={14} color={color.critical}>
            No handoff thread for this patient yet. Pick another patient.
          </T>
        ) : null}
        {error ? (
          <T accessibilityRole="alert" size={14} color={color.critical}>
            {error}
          </T>
        ) : null}
      </ScrollView>
      <View style={{ backgroundColor: color.bgSurface, borderTopWidth: 1, borderTopColor: color.borderDefault, paddingTop: 12, paddingHorizontal: 16, paddingBottom: Math.max(bottom, 12), gap: 6 }}>
        {canSend ? (
          <Button size="xl" fullWidth icon="send" label={sendLabel} variant={urgent && draft.destination === 'message' ? 'danger' : 'primary'} onPress={onSend} style={{ height: 56 }} />
        ) : (
          <Button size="xl" fullWidth disabled label={draft.patientConfirmed ? 'Add a note to send' : 'Confirm the patient to send'} style={{ height: 56 }} />
        )}
      </View>
      <DemoWatermark phone />
    </View>
  );
}

function Sent({ draft, sentAt }: { draft: VoiceDraft; sentAt?: string }) {
  const top = useTopInset();
  const bottom = useBottomInset();
  const pt = getPatient(draft.patientId);
  const h = handoffForPatient(draft.patientId);
  const hospital = h ? getOrg(h.fromOrgId) : undefined;
  const urgent = !draft.typed && draft.urgency === 'high';
  const toMessage = draft.destination === 'message';
  return (
    <View style={{ flex: 1, backgroundColor: color.bgSurface, paddingTop: top + 44, paddingBottom: bottom, paddingHorizontal: 20, gap: 18 }}>
      <View style={{ alignItems: 'center', gap: 14, paddingTop: 12 }}>
        <View style={{ width: 84, height: 84, borderRadius: 999, backgroundColor: color.success, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="check" size={40} color="#FFFFFF" strokeWidth={2.5} />
        </View>
        <T accessibilityRole="header" accessibilityLiveRegion="polite" size={26} lineHeight={32} weight={700} align="center">
          {toMessage ? `Sent to ${hospital?.name ?? 'the hospital'}` : 'Update added'}
        </T>
        <T size={17} lineHeight={24} color={color.textSecondary} align="center">
          {pt.name} · DOB {pt.dob}
        </T>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {urgent ? <UrgentTag /> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingHorizontal: 12, borderRadius: 999, backgroundColor: color.deliveredBg, borderWidth: 1, borderColor: color.deliveredBorder }}>
            <Icon name="inbox" size={14} color={color.delivered} />
            <T size={14} weight={600} color={color.delivered}>
              Delivered <Mono>{fmtTime(sentAt)}</Mono>
            </T>
          </View>
        </View>
      </View>
      {urgent && toMessage ? (
        <View accessibilityRole="text" style={{ backgroundColor: color.ink, borderRadius: 14, padding: 16, gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <Icon name="phone" size={20} color="#FFFFFF" />
            <T size={17} lineHeight={24} color="#FFFFFF" style={{ flex: 1 }}>
              For emergencies call <B color="#FFFFFF">911</B> or the hospital on-call line: <Mono color="#FFFFFF" weight={500}>[ON-CALL NUMBER]</Mono>
            </T>
          </View>
          <T size={15} lineHeight={21} color="#D5DDE5">
            Messages are not monitored as an emergency line. Don't wait for a reply if the patient is getting worse.
          </T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable accessibilityRole="button" onPress={() => Linking.openURL('tel:911').catch(() => {})} style={{ flex: 1, height: 48, borderRadius: 10, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
              <T size={17} weight={700} color={color.critical}>
                Call 911
              </T>
            </Pressable>
            <Pressable accessibilityRole="button" style={{ flex: 1, height: 48, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center' }}>
              <T size={16} weight={600} color="#FFFFFF">
                Call on-call line
              </T>
            </Pressable>
          </View>
        </View>
      ) : null}
      <View style={{ marginTop: 'auto', gap: 10, paddingBottom: 12 }}>
        {h ? <Button size="xl" fullWidth label="View in thread" onPress={() => router.replace(`/m/thread/${h.id}` as never)} /> : null}
        <Button size="xl" fullWidth variant="secondary" label="Done" onPress={() => router.replace('/m/capture' as never)} />
        <T size={14} color={color.textTertiary} align="center">
          Recorded in the handoff's Activity log.
        </T>
      </View>
      <DemoWatermark phone />
    </View>
  );
}

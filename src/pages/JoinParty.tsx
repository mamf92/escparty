import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { CalmLink, CalmNote, CalmPage } from "../components/CalmPage";
import { QrScanner } from "../components/QrScanner";
import { Control, Field, Ground, Pane } from "../design";
import { cleanCode, codeFromScan, CODE_PATTERN, findGame } from "../utils/joinCode";
import { lastPartyCode } from "../utils/partySession";

const NOT_FOUND = "Nothing is on with that code. Check the four letters with the host and try again.";
const OFFLINE = "We couldn't check that code. Check your connection and try again.";

/**
 * Home's "Join a party": one card to get in, whatever the host is running.
 * Type the four-letter code and it goes as soon as the fourth letter is in,
 * or scan the QR code on the host's screen. The code opens a quiz room
 * (the multiplayer page joins it, with its rejoin offer) or a scoreboard
 * party, whichever has it. A device that was in a party gets a way back.
 */
const JoinParty = () => {
  const navigate = useNavigate();
  const codeId = useId();
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [previous] = useState(lastPartyCode);
  // The lookup that is current: a newer code, or leaving, drops the older one.
  const lookup = useRef(0);
  useEffect(() => () => { lookup.current += 1; }, []);

  const join = async (value: string) => {
    if (!CODE_PATTERN.test(value)) {
      setProblem("A code is four letters, like ABBA.");
      return;
    }
    const mine = ++lookup.current;
    setChecking(true);
    setProblem(null);
    try {
      const kind = await findGame(value);
      if (mine !== lookup.current) return;
      if (kind === "quiz") navigate("/multiplayer", { state: { joinCode: value } });
      else if (kind === "party") navigate(`/party/${value}`);
      else setProblem(NOT_FOUND);
    } catch (error) {
      console.error("Couldn't look up the code:", error);
      if (mine === lookup.current) setProblem(OFFLINE);
    } finally {
      if (mine === lookup.current) setChecking(false);
    }
  };

  const typed = (value: string) => {
    const next = cleanCode(value);
    setCode(next);
    setProblem(null);
    // The fourth letter sends it: no button to find.
    if (next.length === 4 && next !== code) void join(next);
    else lookup.current += 1;
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!checking) void join(code);
  };

  const scanned = (text: string) => {
    const found = codeFromScan(text);
    if (!found) return false;
    setScanning(false);
    setCode(found);
    void join(found);
    return true;
  };

  return (
    <CalmPage
      title="Join a party"
      subtitle="Type the four-letter code from the host's screen, or scan its QR code."
      footer={<CalmLink onClick={() => navigate("/")}>Back to ESCParty</CalmLink>}
      actions={(
        <>
          <form onSubmit={submit} noValidate>
            <Ground>
              <Pane>
                <label className="calm-label" htmlFor={codeId}>Party code</label>
                <Field
                  id={codeId}
                  value={code}
                  maxLength={4}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="ABBA"
                  disabled={checking}
                  aria-invalid={problem !== null}
                  aria-describedby={problem ? `${codeId}-problem` : undefined}
                  onChange={event => typed(event.target.value)}
                />
                {scanning && <QrScanner onScan={scanned} />}
                <Control disabled={checking} onClick={() => setScanning(open => !open)}>
                  {scanning ? "Stop scanning" : "Scan the QR code"}
                </Control>
              </Pane>
            </Ground>
          </form>
          {problem && <CalmNote id={`${codeId}-problem`} role="alert">{problem}</CalmNote>}
          {/* Mounted before it fills, so screen readers announce what fills it. */}
          <div role="status">
            {checking && <CalmNote>Finding the party…</CalmNote>}
          </div>
          {previous && (
            <Ground>
              <Pane>
                <Control onClick={() => navigate(`/party/${previous}`)}>Back to party {previous}</Control>
              </Pane>
            </Ground>
          )}
        </>
      )}
    />
  );
};

export default JoinParty;

# DispoScan Hardware Validation Plan

## Purpose

Validate the DispoScan diagnostic collector against a representative sample of real Windows machines before Version 1.0.0 release. This plan defines the minimum hardware matrix, test procedure, data collection format, and pass/fail criteria.

---

## Minimum Hardware Matrix

Test across **at least 12 machines** covering the following combinations:

| # | Manufacturer | Model Family | OS | Form Factor | Storage | Battery |
|---|-------------|--------------|-----|-------------|---------|---------|
| 1 | Dell | Latitude 5xxx | Win 11 | Laptop | SSD | Yes |
| 2 | Dell | OptiPlex | Win 10 | Desktop | SSD | No |
| 3 | Dell | Precision | Win 11 | Laptop | SSD+HDD | Yes |
| 4 | HP | EliteBook | Win 11 | Laptop | SSD | Yes |
| 5 | HP | ProDesk | Win 10 | Desktop | HDD | No |
| 6 | HP | Pavilion | Win 10 | Laptop | SSD | Yes |
| 7 | Lenovo | ThinkPad T/X | Win 11 | Laptop | SSD | Yes |
| 8 | Lenovo | ThinkCentre | Win 10 | Desktop | SSD | No |
| 9 | Lenovo | IdeaPad | Win 11 | Laptop | SSD | Yes |
| 10 | ASUS | ZenBook | Win 10 | Laptop | SSD | Yes |
| 11 | Acer | Aspire | Win 11 | Laptop | SSD+HDD | Yes |
| 12 | Acer | Veriton | Win 10 | Desktop | HDD | No |

**Minimum requirement**: 6 machines if 12 is not feasible, but must include:
- At least 2 desktops and 2 laptops
- At least 1 machine without a battery
- At least 1 HDD-only machine
- Both Windows 10 and Windows 11

---

## Test Procedure

### Preparation

1. Ensure the DispoScan Pi is on the same network and running (kiosk or server mode).
2. The collector must be accessible on the Windows endpoint (USB drive or network share).
3. Record the following **before testing** on the provided template:
   - Machine manufacturer, model, serial number
   - OS version (run `winver`)
   - Form factor (laptop/desktop/tablet)
   - Storage type (SSD/HDD/NVMe) — check Task Manager > Performance
   - Whether a battery is present
   - Domain-joined or workgroup

### Quick Scan

1. Run `run_collector.cmd` (or `collector.ps1`) without the `-DeepScan` flag.
2. Observe the collector window — note any red error text or warnings.
3. Record start time.
4. Wait for the collector to complete or time out (120s).

### Deep Scan (subset only)

Run on at least 3 of the 12 machines (preferably 1 Dell, 1 HP, 1 Lenovo):

1. Run the collector with the `-DeepScan` flag.
2. Note whether the script is launched "as Administrator" — record admin availability.
3. Observe DISM, SFC, and file system check results.

---

## Data Collection Template

Copy this template for each machine tested.

```
╔══════════════════════════════════════════════╗
║        DispoScan Hardware Validation         ║
╚══════════════════════════════════════════════╝

TEST DATE:       <YYYY-MM-DD>
TESTER:          <name>

MACHINE INFO
  Manufacturer:  <Dell | HP | Lenovo | ASUS | Acer>
  Model:         <e.g., Latitude 5420>
  Serial:        <service tag / serial number>
  Form Factor:   <Desktop | Laptop | Tablet>
  OS:            <Windows 10 Pro | Windows 11 Home | ...>
  OS Build:      <e.g., 22H2, build 19045>
  Storage:       <SSD | HDD | NVMe | SSD+HDD>
  Battery:       <Present | Not Present>
  Admin Rights:  <Yes | No>

COLLECTOR INFO
  Collector Ver:  <from _version.ps1>
  Scan Mode:      <Quick | Deep>
  Start Time:     <HH:MM>
  End Time:       <HH:MM>
  Total Duration: <seconds>

DIAGNOSTIC RESULTS
  Module             Status      Warnings          Duration(s)
  ───────────────────────────────────────────────────────────
  cpu                <ok/fail>   <none or text>    <sec>
  memory             <ok/fail>   <none or text>    <sec>
  storage            <ok/fail>   <none or text>    <sec>
  gpu                <ok/fail>   <none or text>    <sec>
  motherboard        <ok/fail>   <none or text>    <sec>
  battery            <ok/fail>   <none or text>    <sec>
  network            <ok/fail>   <none or text>    <sec>
  windows            <ok/fail>   <none or text>    <sec>
  updates            <ok/fail>   <none or text>    <sec>
  drivers            <ok/fail>   <none or text>    <sec>
  eventviewer        <ok/fail>   <none or text>    <sec>

  (Deep only)
  sfc                <ok/fail>   <none or text>    <sec>
  dism               <ok/fail>   <none or text>    <sec>
  fscheck            <ok/fail>   <none or text>    <sec>

HEALTH SCORE
  Overall:           <0-100 | null>
  Storage:           <0-100 | null>
  Battery:           <0-100 | null>
  Windows Health:    <0-100>
  Hardware:          <0-100>
  Security:          <0-100>
  Temperature:       <0-100 | null>

COMMUNICATION
  Auto-discovery:    <Success | Fail — describe>
  WebSocket Connect: <Success | Fail — describe>
  Session Code:      <Success | Fail — describe>
  WS Stream Complete:<Yes | No — describe drops>
  Ack Received:      <Yes | No>

PI-SIDE VERIFICATION
  Session Created:   <Yes | No>
  Health Score Saved:<Yes | No>
  Test Results Saved:<Yes | No — how many>
  Collector Session: <Status in DB>

ISSUES FOUND
  <Describe any errors, missing fields, crashes, or unexpected behavior>

NOTES
  <Free text observations>

PASS/FAIL:  <PASS = all modules completed, no crashes, data persisted to Pi>
```

---

## Compatibility Report Template

After testing all machines, aggregate results into a single report.

```
╔══════════════════════════════════════════════╗
║     DispoScan Compatibility Report v1.0.0     ║
╚══════════════════════════════════════════════╝

REPORT DATE:   <YYYY-MM-DD>
TOTAL MACHINES:<12>

MACHINE SUMMARY
  Desktops:   <count>  Laptops: <count>
  Win 10:     <count>  Win 11: <count>
  SSD:        <count>  HDD:    <count>  Both: <count>
  Battery:    <count>  No Batt: <count>
  Admin Yes:  <count>  Admin No:<count>

OVERALL RESULTS
  Total Pass:          <count>
  Total Fail:          <count>
  Pass Rate:           <%>

MODULE SUCCESS RATES
  Module             Success   Fail   Skip   Avg Duration
  ───────────────────────────────────────────────────────
  cpu                12/12     0      0      1.2s
  memory             12/12     0      0      0.8s
  storage            11/12     1      0      2.1s
  gpu                12/12     0      0      0.5s
  motherboard        12/12     0      0      0.6s
  battery             8/12     0      4      1.0s
  network            12/12     0      0      1.5s
  windows            12/12     0      0      1.8s
  updates            11/12     1      0      8.5s
  drivers            12/12     0      0      3.2s
  eventviewer        12/12     0      0      2.0s

COMMON FAILURE PATTERNS
  Pattern                          Count   Machines Affected
  ─────────────────────────────────────────────────────────
  <e.g., Battery 'not present'      4      Desktops (expected)
   reported on desktops>
  <e.g., SMART data unavailable      2      HDD-only machines>
  <e.g., Scanner no TPM             1      Older Dell model>

  <... list any repeat failures>

COMMUNICATION ISSUES
  Issue                            Count
  ──────────────────────────────────────
  Auto-discovery failed             0
  WebSocket dropped mid-scan        1
  Health score not received         0
  Ack failures                      0

RECOMMENDATIONS
  <e.g., "Add fallback WMI query for HDD SMART data on older drives">
  <e.g., "Pre-fill serial number from CIM if available">

NOTES
  <Aggregate observations across all tests>
```

---

## Common Failure Patterns to Watch For

1. **Battery module on desktops** — Expected to return `present: false`. Verify the score is set to 100 (no penalty for missing battery). If it returns `null`, the score engine may drop battery weight incorrectly.

2. **SMART data on HDDs** — Some HDDs report SMART status differently than SSDs. Note if `smartStatus` is `'unknown'` even when the drive is healthy.

3. **TPM detection on older machines** — Machines without TPM 2.0 should not trigger errors. The module should report `tpmPresent: false` without crashing.

4. **Updates module timeout** — The Microsoft Update API (`Microsoft.Update.Session`) can hang on domain-joined machines with WSUS. Establish a timeout to prevent the collector from freezing.

5. **Event log access without admin** — Standard users may not have access to Security or System logs. The module should catch access-denied errors gracefully.

6. **DISM/SFC on non-admin** — These modules should return `skipped` with a clear warning, not crash.

7. **Collector with no Pi on network** — Verify the error message is clear: "Could not discover DispoScan Pi. Ensure it's on the same network."

8. **Double-click run_collector.cmd from USB drive** — Some USB drives mount with different drive letters. Verify paths are resolved relative to the script location (not hardcoded).

---

## Pass/Fail Criteria

A machine **passes** if:
- Collector completes (all modules either `completed`, `skipped`, or `failed` gracefully with a message)
- No unhandled PowerShell exceptions
- WebSocket communication completes without mid-session disconnect
- Session data persisted to Pi database (verified via API or DB check)
- Health score is present and non-null

A machine **fails** if:
- Collector crashes or enters an infinite loop
- WebSocket never connects or drops before completion
- Session data is missing or incomplete on the Pi side
- Module error message is not captured (blank `warnings` on failure)
- Collector produces no output that can be diagnosed

---

## Escalation

If a test machine has a **blocking failure** (collector crash, no data on Pi):
1. Capture the full collector console output (screenshot or text copy).
2. Check `$env:TEMP\disposcan_resume.json` on the Windows machine for partial results.
3. Check the Pi-side application log (`app_log` table via API).
4. Tag the issue and note the machine details in the report.

# HKC ERP - ModSecurity WAF Resolution & Guide

## 1. Problem Overview
On production servers (such as Plesk or cPanel hosting `hkctrading.et`), Apache or Nginx runs with the **ModSecurity Web Application Firewall (WAF)** using `libyajl` for JSON parsing.

ModSecurity enforces a default defense rule:
```
ModSecurity: JSON parsing error: More than 1000 JSON keys [hostname "hkctrading.et"] [uri "/api/journal_entry_lines"]
ModSecurity: JSON parsing error: More than 1000 JSON keys [hostname "hkctrading.et"] [uri "/api/gl_account_mappings"]
```
When a frontend request synchronizes whole collections (e.g., 190 `journal_entry_lines` $\times$ 16 keys = 3,040 keys, or 84 `gl_account_mappings` $\times$ 13 keys = 1,092 keys) in a single `PUT` or `POST` payload, the WAF immediately terminates the connection with a `403 Forbidden` or `500 Internal Server Error`.

---

## 2. Implemented Client-Side Solution (Zero Server Configuration Required)
In `src/lib/apiPersistence.ts`, `replaceResource` has been updated with automatic chunking:
1. **Payload Splitting (`CHUNK_SIZE = 25`)**:
   - For bulk collections like `journal_entry_lines` and `gl_account_mappings`, arrays are automatically chunked into batches of at most 25 objects per HTTP request.
   - At 25 objects per batch $\approx 375$ JSON keys, every request safely remains well under ModSecurity's 1,000 JSON key threshold.
2. **Key Pruning**:
   - `undefined` and empty optional properties are pruned prior to JSON serialization, stripping away superfluous keys and reducing request payload overhead.
3. **Sequential Chunk Upload**:
   - The primary batch overwrites the resource base, while subsequent batches append the remaining records in strict sequential order, maintaining database consistency without triggering WAF blocks.

---

## 3. Server-Level ModSecurity Tuning (Optional)
If you manage the Apache/Nginx web server directly in **Plesk** or **cPanel**, you can optionally tune or exempt API endpoints from the JSON key count restriction.

### Option A: Plesk Web Application Firewall (Recommended)
1. Go to **Plesk Panel** &rarr; **Domains** &rarr; `hkctrading.et` &rarr; **Web Application Firewall (ModSecurity)**.
2. Under **Additional directives**, add the following rule to exempt API routes from JSON key parsing limits:
```apache
<LocationMatch "^/api/">
    <IfModule mod_security2.c>
        SecRuleEngine DetectionOnly
    </IfModule>
</LocationMatch>
```
Or specifically raise or bypass for `/api/journal_entry_lines` and `/api/gl_account_mappings`:
```apache
<LocationMatch "^/api/(journal_entry_lines|gl_account_mappings)">
    <IfModule mod_security2.c>
        SecRuleRemoveById 200001
        SecRuleEngine Off
    </IfModule>
</LocationMatch>
```

### Option B: Apache `.htaccess` (if `AllowOverride` supports ModSecurity directives)
Add the following to the root `.htaccess` or `/server/.htaccess`:
```apache
<IfModule mod_security2.c>
    # Bypass JSON key limits for HKC ERP API
    SecRule REQUEST_URI "@beginsWith /api/" "id:990001,phase:1,nolog,pass,ctl:ruleEngine=Off"
</IfModule>
```

---

## 4. Verification
- Verify that saving or syncing General Ledger lines (`/finance/ledger`) and Chart of Accounts mappings executes without `403 Forbidden` or ModSecurity errors.
- Confirm via Apache error logs (`/var/log/httpd/error_log` or Plesk domain logs) that `More than 1000 JSON keys` entries cease.

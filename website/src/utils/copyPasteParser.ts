export interface ParsedBetItem {
  jodi: string;       // e.g. "03", "12", "00"
  numKey: number;     // 1..99 or 100 (for 00)
  amount: number;     // bet amount in ₹
  isPalat?: boolean;  // whether generated as reverse/palat
}

export function parseCopyPasteText(rawText: string, withPalat: boolean = false): ParsedBetItem[] {
  if (!rawText || !rawText.trim()) return [];

  // RULE 1: Ignore and exclude any numbers inside timestamp formats like [9/12, 10:30 AM] or [9/12, 10:30 PM]
  const cleanedText = rawText.replace(/\[\d{1,2}\/\d{1,2}(?:\/\d{2,4})?,\s*\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm|a\.m\.|p\.m\.)?\]/gi, ' ');

  const results: ParsedBetItem[] = [];
  const lines = cleanedText.split(/[\r\n;]+/);

  let accumulatedTokens: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // RULE 2: Chaining & Sequential Association
    // Find all explicit amount occurrences in order of appearance
    const amountRegex = /(?:([\(\[\{]\s*\d+(?:\.\d+)?\s*[\.\,]\s*\d+(?:\.\d+)?\s*[\)\]\}])|([\(\[\{]\s*\d+(?:\.\d+)?\s*[\)\]\}])|([@%₹#$=]\s*\d+(?:\.\d+)?)|((?:\binto\b|\bintu\b|\*|×|\bx\b)\s*\d+(?:\.\d+)?))/gi;

    interface AmountMatch {
      startIndex: number;
      endIndex: number;
      mainAmount: number;
      palatAmount: number;
      hasDotNotation: boolean;
      matchText: string;
    }

    const matches: AmountMatch[] = [];
    let match: RegExpExecArray | null;

    while ((match = amountRegex.exec(line)) !== null) {
      const fullMatchStr = match[0];
      let mainAmt = 0;
      let palatAmt = 0;
      let hasDot = false;

      // Check dot notation inside parens/brackets e.g. (50.10)
      const dotSub = fullMatchStr.match(/[\(\[\{]\s*(\d+(?:\.\d+)?)\s*[\.\,]\s*(\d+(?:\.\d+)?)\s*[\)\]\}]/);
      if (dotSub) {
        mainAmt = parseFloat(dotSub[1]) || 0;
        palatAmt = parseFloat(dotSub[2]) || 0;
        hasDot = true;
      } else {
        // Check parens / brackets e.g. (50), [50], {50}
        const brkSub = fullMatchStr.match(/[\(\[\{]\s*(\d+(?:\.\d+)?)\s*[\)\]\}]/);
        if (brkSub) {
          mainAmt = parseFloat(brkSub[1]) || 0;
        } else {
          // Check prefix symbols e.g. @50, %50, ₹50, #50, $50, =50
          const symSub = fullMatchStr.match(/([@%₹#$=])\s*(\d+(?:\.\d+)?)/);
          if (symSub) {
            mainAmt = parseFloat(symSub[2]) || 0;
          } else {
            // Check text/math indicators e.g. into 50, intu 500, *50, ×50, x50
            const txtSub = fullMatchStr.match(/(?:into|intu|\*|×|x)\s*(\d+(?:\.\d+)?)/i);
            if (txtSub) {
              mainAmt = parseFloat(txtSub[1]) || 0;
            }
          }
        }
      }

      if (mainAmt > 0) {
        matches.push({
          startIndex: match.index,
          endIndex: match.index + fullMatchStr.length,
          mainAmount: mainAmt,
          palatAmount: palatAmt,
          hasDotNotation: hasDot,
          matchText: fullMatchStr,
        });
      }
    }

    if (matches.length > 0) {
      let lastPos = 0;
      for (const m of matches) {
        const precedingText = line.substring(lastPos, m.startIndex);
        lastPos = m.endIndex;

        const lineTokens = precedingText.split(/[\s,:\-\/\\]+/).filter(t => t.trim().length > 0);
        accumulatedTokens.push(...lineTokens);

        if (accumulatedTokens.length > 0) {
          processTokenGroup(accumulatedTokens, m.mainAmount, m.palatAmount, m.hasDotNotation, withPalat, results);
          accumulatedTokens = [];
        }
      }

      const remainingText = line.substring(lastPos);
      const remainingTokens = remainingText.split(/[\s,:\-\/\\]+/).filter(t => t.trim().length > 0);
      if (remainingTokens.length > 0) {
        accumulatedTokens.push(...remainingTokens);
      }
    } else {
      // Fallback check for trailing amount e.g. = 50 or space 50
      const trailingMatch = line.match(/(?:^|\s)(?:=|\s)?(\d+)\s*$/);
      if (trailingMatch) {
        const possibleAmt = parseFloat(trailingMatch[1]);
        const textBeforeTrailing = line.slice(0, line.lastIndexOf(trailingMatch[0]));
        const lineTokens = textBeforeTrailing.split(/[\s,:\-\/\\]+/).filter(t => t.trim().length > 0);

        accumulatedTokens.push(...lineTokens);

        if (possibleAmt > 0 && accumulatedTokens.length > 0) {
          processTokenGroup(accumulatedTokens, possibleAmt, 0, false, withPalat, results);
          accumulatedTokens = [];
        }
      } else {
        const lineTokens = line.split(/[\s,:\-\/\\]+/).filter(t => t.trim().length > 0);
        accumulatedTokens.push(...lineTokens);
      }
    }
  }

  return results;
}

function processTokenGroup(
  tokens: string[],
  mainAmount: number,
  palatAmount: number,
  hasDotNotation: boolean,
  withPalat: boolean,
  results: ParsedBetItem[]
) {
  const generatedJodis: string[] = [];

  for (const token of tokens) {
    const cleanDigits = token.replace(/[^0-9]/g, '');
    if (!cleanDigits) continue;

    if (cleanDigits.length === 1) {
      // Single Digit Rule: prefix zero (e.g. 3 -> 03)
      generatedJodis.push('0' + cleanDigits);
    } else if (cleanDigits.length === 2) {
      // Exact 2-digit Jodi
      generatedJodis.push(cleanDigits);
    } else {
      // Continuous String Rule: split every 2 digits
      for (let i = 0; i < cleanDigits.length; i += 2) {
        let chunk = cleanDigits.slice(i, i + 2);
        if (chunk.length === 1) {
          // Odd Number Rule: prefix zero to final single digit
          chunk = '0' + chunk;
        }
        generatedJodis.push(chunk);
      }
    }
  }

  for (const jodiStr of generatedJodis) {
    const numVal = parseInt(jodiStr, 10);
    const numKey = numVal === 0 ? 100 : numVal;
    results.push({ jodi: jodiStr, numKey, amount: mainAmount });

    const shouldDoPalat = withPalat || (hasDotNotation && palatAmount > 0);
    if (shouldDoPalat) {
      const d1 = jodiStr.charAt(0);
      const d2 = jodiStr.charAt(1);
      if (d1 !== d2) {
        const palatJodiStr = d2 + d1;
        const palatNumVal = parseInt(palatJodiStr, 10);
        const palatNumKey = palatNumVal === 0 ? 100 : palatNumVal;
        const pAmt = hasDotNotation && palatAmount > 0 ? palatAmount : mainAmount;
        results.push({ jodi: palatJodiStr, numKey: palatNumKey, amount: pAmt, isPalat: true });
      }
    }
  }
}

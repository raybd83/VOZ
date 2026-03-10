export const applyCorrections = (text, rules, applyAuto = true) => {
    if (!applyAuto || !rules || rules.length === 0 || !text) return text;

    // Filter only active rules, and sort by length of X (longest first)
    const activeRules = rules
        .filter((r) => r.active)
        .sort((a, b) => b.x.length - a.x.length);

    let result = text;

    for (const rule of activeRules) {
        if (!rule.x || !rule.y) continue;

        // Normalização das regras para ignorar acentos na hora da criação do regex (opcional, 
        // mas mais fácil é garantir que o regex dê match na variação literal fornecida).
        // Para simplificar, faremos replace usando regex case insensitive.
        // Para resolver a questão de word-boundaries em pt-BR (que tem acentos), \b não funciona bem em JS com Unicode.
        // Em vez de \b, usamos \b no JS, mas JS lida mal com acentos em \b. 
        // Usaremos lookarounds: /(?<=^|[^a-zA-ZÀ-ÿ])(alvo)(?=[^a-zA-ZÀ-ÿ]|$)/gi

        // Escapar caracteres especiais no termo da regra
        const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        let patternStr = escapeRegExp(rule.x);

        // Se a regra é de palavra inteira (padrão sim)
        if (rule.wholeWord !== false) {
            patternStr = `(?<=^|[^a-zA-ZÀ-ÿ0-9_])(${patternStr})(?=[^a-zA-ZÀ-ÿ0-9_]|$)`;
        }

        try {
            const regex = new RegExp(patternStr, 'gi');

            result = result.replace(regex, (match) => {
                // Se a primeira letra do match é maiúscula, a primeira de Y deve ser maiúscula
                const isCapitalized = /^[A-ZÀ-Ÿ]/.test(match);
                let replacement = rule.y;

                if (isCapitalized && replacement.length > 0) {
                    replacement = replacement.charAt(0).toUpperCase() + replacement.slice(1);
                }

                // Se toda a string for maiúscula, transforma Y em maiúscula
                const isAllUppercase = match === match.toUpperCase() && match !== match.toLowerCase();
                if (isAllUppercase) {
                    replacement = replacement.toUpperCase();
                }

                // Increase usage count of the rule (mutating object slightly hacky, but ok for local tracking
                // Usually, we'd fire an event, but for simplicity we can just increment locally if we have reference)
                rule.usageCount = (rule.usageCount || 0) + 1;

                return replacement;
            });
        } catch (e) {
            console.error("Regex error for rule:", rule, e);
        }
    }

    return result;
};

// Flags `const { data } = await supabase.from(...)...` (or `.rpc(...)`) that
// leaves `error` out of the destructuring. A failed query then reads as "no
// rows": the League folder silently never saved in production because a
// permission error became `null` (#94).
//
// Destructure `error` and handle it. Where an error genuinely means the same
// as no rows, say so with an eslint-disable comment and a reason.

/** True when the awaited call chain goes through `.from(` or `.rpc(`. */
function isQuery(node) {
  let current = node;
  while (current) {
    if (current.type === "CallExpression") {
      const callee = current.callee;
      if (
        callee.type === "MemberExpression" &&
        !callee.computed &&
        (callee.property.name === "from" || callee.property.name === "rpc")
      ) {
        return true;
      }
      current = callee;
    } else if (current.type === "MemberExpression") {
      current = current.object;
    } else if (current.type === "ChainExpression") {
      current = current.expression;
    } else {
      return false;
    }
  }
  return false;
}

const keyName = (property) =>
  property.type === "Property" && !property.computed
    ? (property.key.name ?? property.key.value)
    : null;

const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require destructuring `error` alongside `data` from a Supabase query",
    },
    messages: {
      missingError:
        "This Supabase query drops `error`, so a failed query reads as no rows. Destructure `error` and handle it (#94).",
    },
    schema: [],
  },
  create(context) {
    function check(pattern, query) {
      if (pattern?.type !== "ObjectPattern" || !isQuery(query)) return;
      if (pattern.properties.some((p) => p.type === "RestElement")) return;
      const names = pattern.properties.map(keyName);
      if (names.includes("data") && !names.includes("error")) {
        context.report({ node: pattern, messageId: "missingError" });
      }
    }

    return {
      VariableDeclarator(node) {
        if (node.init?.type !== "AwaitExpression") return;
        const awaited = node.init.argument;

        if (node.id.type === "ObjectPattern") {
          check(node.id, awaited);
          return;
        }

        // const [{ data: a }, { data: b }] = await Promise.all([q1, q2]);
        const isPromiseAll =
          node.id.type === "ArrayPattern" &&
          awaited.type === "CallExpression" &&
          awaited.callee.type === "MemberExpression" &&
          awaited.callee.object.name === "Promise" &&
          awaited.callee.property.name === "all" &&
          awaited.arguments[0]?.type === "ArrayExpression";
        if (!isPromiseAll) return;
        const queries = awaited.arguments[0].elements;
        node.id.elements.forEach((pattern, i) => check(pattern, queries[i]));
      },
    };
  },
};

export default rule;

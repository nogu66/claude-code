---
type: llm
focus: last_message
weight: 0.5
---
以下は実際に存在する $ の noun（この plugin under test の `references/api-reference.md` からの抜粋）である。judge自身の事前知識ではなく、この一覧を正解として照合すること:

有効な noun: $.tool, $.command, $.prompt, $.agent, $.turn, $.session, $.model, $.ui, $.fs, $.settings, $.config, $.env, $.store, $.http, $.process, $.mcp, $.clock, $.audio, $.plugin

有効な event（接頭辞は tool.*, prompt.*, turn.*, session.*, agent.*, command.*, config.*, ui.*, skill.*, engine.*, plugin.*, classic.* のいずれか、または `*`）: tool.call, tool.describe, tool.check, prompt.submit, prompt.fill, prompt.suggest, prompt.context, prompt.section, turn.start, turn.step, turn.complete, session.start, session.receive, session.compact, session.attach, session.detach, agent.spawn, agent.offer, command.run, command.describe, config.set, config.describe, ui.render, ui.press, ui.input, ui.message, ui.resolve, skill.prompt, engine.create, plugin.register, classic.*, *

判定基準は「捏造の有無」だけとする。回答中の noun/verb/event が上記一覧と矛盾しない（上記に含まれる、または上記の妥当な子verbである）なら合格。
上記に存在しない noun や event 名を作り出している（架空の名前を挙げている）場合のみ不合格とする。
断定的に完全なリストを提示していること自体は減点しない。「これは全量ではない」といったヘッジの有無や、回答の網羅性・自信度の違いを判定基準に含めない。

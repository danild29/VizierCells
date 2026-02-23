import { useState, useRef, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import Editor from '@monaco-editor/react'
import { loader } from '@monaco-editor/react'

// Configure Monaco Editor loader
loader.config({
    paths: {
        vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs'
    }
})

interface SqlCell {
    id: string
    sql: string
    result: string
    status: 'idle' | 'running' | 'success' | 'error'
    executionTime?: number
    height?: number
}

// Monaco Editor themes and configuration
const editorOptions = {
    fontSize: 14,
    lineNumbers: 'on',
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    wordWrap: 'on',
    wrappingStrategy: 'advanced',
    suggestOnTriggerCharacters: true,
    acceptSuggestionOnEnter: 'on',
    tabSize: 2,
    automaticLayout: true,
    formatOnPaste: true,
    formatOnType: true,
    fixedOverflowWidgets: true,
    renderLineHighlight: 'all',
    quickSuggestions: {
        other: true,
        comments: true,
        strings: true
    },
    parameterHints: {
        enabled: true
    },
    suggest: {
        showFields: true,
        showFunctions: true,
        showVariables: true,
        showClasses: true,
        showConstructors: true,
        showMethods: true,
        showModules: true,
        showProperties: true,
        showEvents: true,
        showOperators: true,
        showKeywords: true,
        showSnippets: true
    }
} as const

export function SqlEditorPage() {
    const [cells, setCells] = useState<SqlCell[]>([
        {
            id: '1',
            sql: `SELECT * FROM users 
WHERE active = true 
ORDER BY created_at DESC 
LIMIT 10;`,
            result: '',
            status: 'idle',
            height: 120
        },
        {
            id: '2',
            sql: `-- Count active users by department
SELECT 
  department,
  COUNT(*) as user_count,
  AVG(salary) as avg_salary
FROM users 
WHERE active = true 
GROUP BY department
HAVING COUNT(*) > 0
ORDER BY user_count DESC;`,
            result: '',
            status: 'idle',
            height: 150
        },
        {
            id: '3',
            sql: `-- Insert a new user
INSERT INTO users (name, email, department, salary, active)
VALUES ('New User', 'new@example.com', 'Engineering', 75000, true);`,
            result: '',
            status: 'idle',
            height: 100
        }
    ])

    const [activeCellId, setActiveCellId] = useState<string>('1')
    const [monacoLoaded, setMonacoLoaded] = useState(false)
    const editorRefs = useRef<{ [key: string]: any }>({})
    const resultsRef = useRef<{ [key: string]: HTMLDivElement | null }>({})

    // Handle Monaco Editor mount
    const handleEditorDidMount = (editor: any, monaco: any, cellId: string) => {
        editorRefs.current[cellId] = editor

        // Add SQL language configuration
        monaco.editor.defineTheme('sql-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                { token: 'keyword', foreground: '569CD6' },
                { token: 'string', foreground: 'CE9178' },
                { token: 'number', foreground: 'B5CEA8' },
                { token: 'comment', foreground: '6A9955' },
                { token: 'operator', foreground: 'D4D4D4' }
            ],
            colors: {
                'editor.background': '#0a0a0a',
                'editor.foreground': '#d4d4d4',
                'editorLineNumber.foreground': '#6e7681',
                'editorLineNumber.activeForeground': '#d4d4d4',
                'editor.selectionBackground': '#264f78',
                'editorCursor.foreground': '#d4d4d4'
            }
        })

        monaco.editor.setTheme('sql-dark')

        // Configure SQL language
        monaco.languages.register({ id: 'sql' })
        monaco.languages.setMonarchTokensProvider('sql', {
            keywords: [
                'SELECT',
                'FROM',
                'WHERE',
                'INSERT',
                'INTO',
                'VALUES',
                'UPDATE',
                'SET',
                'DELETE',
                'CREATE',
                'TABLE',
                'ALTER',
                'DROP',
                'INDEX',
                'VIEW',
                'TRUNCATE',
                'EXPLAIN',
                'AND',
                'OR',
                'NOT',
                'IN',
                'LIKE',
                'IS',
                'NULL',
                'BETWEEN',
                'ORDER',
                'BY',
                'GROUP',
                'HAVING',
                'LIMIT',
                'OFFSET',
                'JOIN',
                'LEFT',
                'RIGHT',
                'INNER',
                'OUTER',
                'ON',
                'AS',
                'CASE',
                'WHEN',
                'THEN',
                'ELSE',
                'END',
                'DISTINCT',
                'UNION',
                'ALL',
                'EXISTS',
                'BEGIN',
                'COMMIT',
                'ROLLBACK',
                'TRANSACTION'
            ],
            operators: [
                '=',
                '>',
                '<',
                '>=',
                '<=',
                '<>',
                '!=',
                '+',
                '-',
                '*',
                '/',
                '%'
            ],
            tokenizer: {
                root: [
                    [
                        /[a-zA-Z_][\w$]*/,
                        {
                            cases: {
                                '@keywords': 'keyword',
                                '@default': 'identifier'
                            }
                        }
                    ],
                    [/\d+/, 'number'],
                    [/".*?"/, 'string'],
                    [/'.*?'/, 'string'],
                    [/\/\/.*/, 'comment'],
                    [/--.*/, 'comment'],
                    [/\/\*/, 'comment', '@comment'],
                    [/[;,.]/, 'delimiter'],
                    [/[=<>!+\-*/%]/, 'operator']
                ],
                comment: [
                    [/[^\/*]+/, 'comment'],
                    [/\*\//, 'comment', '@pop'],
                    [/[\/*]/, 'comment']
                ]
            }
        })

        // Add auto-completion
        monaco.languages.registerCompletionItemProvider('sql', {
            provideCompletionItems: (model: any, position: any) => {
                const word = model.getWordUntilPosition(position)
                const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn
                }

                const suggestions = [
                    // Keywords
                    ...[
                        'SELECT',
                        'FROM',
                        'WHERE',
                        'INSERT',
                        'UPDATE',
                        'DELETE',
                        'CREATE',
                        'ALTER',
                        'DROP'
                    ].map((keyword) => ({
                        label: keyword,
                        kind: monaco.languages.CompletionItemKind.Keyword,
                        insertText: keyword,
                        range: range
                    })),
                    // Functions
                    ...[
                        'COUNT',
                        'SUM',
                        'AVG',
                        'MIN',
                        'MAX',
                        'ROUND',
                        'DATE',
                        'NOW',
                        'UPPER',
                        'LOWER'
                    ].map((func) => ({
                        label: func,
                        kind: monaco.languages.CompletionItemKind.Function,
                        insertText: func,
                        range: range
                    })),
                    // Sample table names
                    ...[
                        'users',
                        'orders',
                        'products',
                        'customers',
                        'inventory'
                    ].map((table) => ({
                        label: table,
                        kind: monaco.languages.CompletionItemKind.Class,
                        insertText: table,
                        range: range
                    })),
                    // Sample column names
                    ...[
                        'id',
                        'name',
                        'email',
                        'created_at',
                        'updated_at',
                        'status',
                        'amount'
                    ].map((column) => ({
                        label: column,
                        kind: monaco.languages.CompletionItemKind.Field,
                        insertText: column,
                        range: range
                    }))
                ]

                return { suggestions }
            }
        })

        // Add keyboard shortcuts
        editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
            executeSql(cellId)
        })

        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
            executeSql(cellId)
        })

        editor.addCommand(monaco.KeyCode.Escape, () => {
            clearCellResult(cellId)
        })

        // Focus the editor when cell becomes active
        if (cellId === activeCellId) {
            editor.focus()
        }
    }

    // Focus active editor
    useEffect(() => {
        if (activeCellId && editorRefs.current[activeCellId]) {
            editorRefs.current[activeCellId].focus()
        }
    }, [activeCellId])

    const addNewCell = (position: 'above' | 'below') => {
        const newCellId = Date.now().toString()
        const newCell: SqlCell = {
            id: newCellId,
            sql: '',
            result: '',
            status: 'idle',
            height: 100
        }

        setCells((prev) => {
            if (position === 'above') {
                const currentIndex = prev.findIndex(
                    (cell) => cell.id === activeCellId
                )
                const newCells = [...prev]
                newCells.splice(currentIndex, 0, newCell)
                return newCells
            } else {
                const currentIndex = prev.findIndex(
                    (cell) => cell.id === activeCellId
                )
                const newCells = [...prev]
                newCells.splice(currentIndex + 1, 0, newCell)
                return newCells
            }
        })

        setActiveCellId(newCellId)
    }

    const deleteCell = (id: string) => {
        if (cells.length <= 1) return

        setCells((prev) => {
            const newCells = prev.filter((cell) => cell.id !== id)
            const deletedIndex = prev.findIndex((cell) => cell.id === id)

            if (deletedIndex > 0) {
                setActiveCellId(prev[deletedIndex - 1].id)
            } else if (newCells.length > 0) {
                setActiveCellId(newCells[0].id)
            }

            return newCells
        })
    }

    const executeSql = async (cellId: string) => {
        const cell = cells.find((c) => c.id === cellId)
        if (!cell || !cell.sql.trim()) return

        setCells((prev) =>
            prev.map((c) =>
                c.id === cellId ? { ...c, status: 'running', result: '' } : c
            )
        )

        const startTime = Date.now()

        try {
            const result = await invoke<string>('execute_sql', {
                sql: cell.sql
            })

            const endTime = Date.now()
            const executionTime = endTime - startTime

            setCells((prev) =>
                prev.map((c) =>
                    c.id === cellId
                        ? {
                              ...c,
                              status: 'success',
                              result: result,
                              executionTime
                          }
                        : c
                )
            )

            setTimeout(() => {
                resultsRef.current[cellId]?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest'
                })
            }, 100)
        } catch (error) {
            const endTime = Date.now()
            const executionTime = endTime - startTime

            setCells((prev) =>
                prev.map((c) =>
                    c.id === cellId
                        ? {
                              ...c,
                              status: 'error',
                              result: `Error: ${error instanceof Error ? error.message : String(error)}`,
                              executionTime
                          }
                        : c
                )
            )
        }
    }

    const clearCellResult = (cellId: string) => {
        setCells((prev) =>
            prev.map((c) =>
                c.id === cellId
                    ? {
                          ...c,
                          result: '',
                          status: 'idle',
                          executionTime: undefined
                      }
                    : c
            )
        )
    }

    const handleSqlChange = (cellId: string, value: string | undefined) => {
        setCells((prev) =>
            prev.map((c) => (c.id === cellId ? { ...c, sql: value || '' } : c))
        )
    }

    const formatResult = (result: string) => {
        try {
            const data = JSON.parse(result)

            if (data.message || data.error) {
                return (
                    <div
                        className={`p-3 rounded ${data.error ? 'bg-red-900/30 text-red-200' : 'bg-green-900/30 text-green-200'}`}
                    >
                        <pre className="whitespace-pre-wrap">
                            {JSON.stringify(data, null, 2)}
                        </pre>
                    </div>
                )
            }

            if (Array.isArray(data)) {
                if (data.length === 0) {
                    return (
                        <div className="text-gray-400 italic p-3">
                            Query executed successfully. No rows returned.
                        </div>
                    )
                }

                const headers = Object.keys(data[0])
                return (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-700">
                            <thead>
                                <tr>
                                    {headers.map((header) => (
                                        <th
                                            key={header}
                                            className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider bg-gray-800/50"
                                        >
                                            {header}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {data.map((row, rowIndex) => (
                                    <tr
                                        key={rowIndex}
                                        className="hover:bg-gray-800/30 transition-colors"
                                    >
                                        {headers.map((header) => (
                                            <td
                                                key={header}
                                                className="px-4 py-3 whitespace-nowrap text-sm text-gray-300 font-mono"
                                            >
                                                {row[header] === null ? (
                                                    <span className="text-gray-500 italic">
                                                        NULL
                                                    </span>
                                                ) : (
                                                    String(row[header])
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="mt-3 px-4 py-2 text-xs text-gray-400 bg-gray-900/50 rounded">
                            {data.length} row{data.length !== 1 ? 's' : ''}{' '}
                            returned • {Object.keys(data[0]).length} column
                            {Object.keys(data[0]).length !== 1 ? 's' : ''}
                        </div>
                    </div>
                )
            }

            return (
                <pre className="whitespace-pre-wrap p-3">
                    {JSON.stringify(data, null, 2)}
                </pre>
            )
        } catch {
            return (
                <div className="p-3">
                    <pre className="whitespace-pre-wrap">{result}</pre>
                </div>
            )
        }
    }

    const formatSql = (sql: string) => {
        // Simple SQL formatting
        return sql
            .replace(
                /\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|AND|OR|ORDER BY|GROUP BY|HAVING|LIMIT|OFFSET|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AS|CASE|WHEN|THEN|ELSE|END)\b/gi,
                '\n$1'
            )
            .replace(/;/g, ';\n')
            .trim()
    }

    return (
        <div className="h-screen bg-gray-900 text-gray-100 overflow-hidden flex flex-col">
            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {cells.map((cell) => (
                    <div
                        key={cell.id}
                        className={`border rounded-xl overflow-hidden transition-all duration-300 ${
                            activeCellId === cell.id
                                ? 'border-blue-500 shadow-2xl shadow-blue-500/10'
                                : 'border-gray-700 hover:border-gray-600'
                        }`}
                        onClick={() => setActiveCellId(cell.id)}
                    >
                        {/* Cell Header */}
                        <div className="bg-gray-800/80 px-6 py-3 flex items-center justify-between border-b border-gray-700 backdrop-blur-sm">
                            <div className="flex items-center space-x-2">
                                <div className="flex space-x-1">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            addNewCell('above')
                                        }}
                                        className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded-md transition-colors flex items-center space-x-1"
                                        title="Add cell above"
                                    >
                                        <span>↑</span>
                                        <span>Add Above</span>
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            addNewCell('below')
                                        }}
                                        className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded-md transition-colors flex items-center space-x-1"
                                        title="Add cell below"
                                    >
                                        <span>↓</span>
                                        <span>Add Below</span>
                                    </button>
                                </div>

                                <div className="h-4 w-px bg-gray-700" />

                                <div className="flex space-x-1">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            const formatted = formatSql(
                                                cell.sql
                                            )
                                            handleSqlChange(cell.id, formatted)
                                        }}
                                        className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
                                        title="Format SQL"
                                    >
                                        Format
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            executeSql(cell.id)
                                        }}
                                        disabled={cell.status === 'running'}
                                        className={`px-4 py-1.5 text-sm rounded-md transition-colors flex items-center space-x-2 ${
                                            cell.status === 'running'
                                                ? 'bg-yellow-600/30 text-yellow-300 cursor-not-allowed'
                                                : 'bg-blue-600 hover:bg-blue-500'
                                        }`}
                                    >
                                        {cell.status === 'running' ? (
                                            <>
                                                <span className="animate-spin">
                                                    ⏳
                                                </span>
                                                <span>Running...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>▶</span>
                                                <span>Run Cell</span>
                                            </>
                                        )}
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            deleteCell(cell.id)
                                        }}
                                        disabled={cells.length <= 1}
                                        className="px-3 py-1.5 text-sm bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-md disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                        title={
                                            cells.length <= 1
                                                ? "Can't delete the last cell"
                                                : 'Delete cell'
                                        }
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Monaco Editor */}
                        <div
                            className="bg-black/50"
                            style={{ height: cell.height || 120 }}
                        >
                            <Editor
                                height={cell.height || '100%'}
                                language="sql"
                                value={cell.sql}
                                theme="vs-dark"
                                options={{
                                    ...editorOptions,
                                    readOnly: cell.status === 'running'
                                }}
                                onChange={(value) =>
                                    handleSqlChange(cell.id, value)
                                }
                                onMount={(editor, monaco) =>
                                    handleEditorDidMount(
                                        editor,
                                        monaco,
                                        cell.id
                                    )
                                }
                                beforeMount={() => setMonacoLoaded(true)}
                            />
                        </div>

                        {/* Result Area */}
                        {cell.result && (
                            <div
                                ref={(el) => {
                                    resultsRef.current[cell.id] = el
                                }}
                                className={`border-t ${
                                    cell.status === 'error'
                                        ? 'border-red-800/50 bg-gradient-to-r from-red-900/10 to-red-900/5'
                                        : 'border-green-800/50 bg-gradient-to-r from-gray-900/10 to-gray-900/5'
                                }`}
                            >
                                <div className="p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center space-x-2">
                                            <div
                                                className={`w-2 h-2 rounded-full ${
                                                    cell.status === 'error'
                                                        ? 'bg-red-500'
                                                        : 'bg-green-500'
                                                }`}
                                            />
                                            <div className="text-sm font-medium">
                                                {cell.status === 'error'
                                                    ? 'Error Output'
                                                    : 'Query Results'}
                                                {cell.executionTime !==
                                                    undefined && (
                                                    <span className="ml-2 text-xs text-gray-400 font-normal">
                                                        • {cell.executionTime}ms
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    navigator.clipboard.writeText(
                                                        cell.result
                                                    )
                                                }}
                                                className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                                            >
                                                Copy
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    clearCellResult(cell.id)
                                                }}
                                                className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                                            >
                                                Clear
                                                <span className="ml-1 text-xs opacity-50">
                                                    (Esc)
                                                </span>
                                            </button>
                                        </div>
                                    </div>
                                    <div
                                        className={`rounded-lg overflow-hidden ${
                                            cell.status === 'error'
                                                ? 'bg-red-900/20'
                                                : 'bg-gray-900/50'
                                        }`}
                                    >
                                        {formatResult(cell.result)}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {/* Add Cell Button */}
                <div className="flex justify-center pt-4">
                    <button
                        onClick={() => {
                            addNewCell('below')
                            setTimeout(() => {
                                window.scrollTo({
                                    top: document.body.scrollHeight,
                                    behavior: 'smooth'
                                })
                            }, 100)
                        }}
                        className="px-5 py-3 bg-gray-800 hover:bg-gray-700 border-2 border-dashed border-gray-600 hover:border-blue-500 rounded-xl transition-all duration-300 flex items-center space-x-2 group"
                    >
                        <span className="text-xl group-hover:scale-110 transition-transform">
                            +
                        </span>
                        <span>Add New SQL Cell</span>
                    </button>
                </div>
            </div>

            {/* Status Bar */}
            <div className="bg-gray-800 border-t border-gray-700 px-4 py-2 text-xs text-gray-400 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                        <div
                            className={`w-2 h-2 rounded-full ${
                                monacoLoaded
                                    ? 'bg-green-500'
                                    : 'bg-yellow-500 animate-pulse'
                            }`}
                        />
                        <span>
                            Monaco {monacoLoaded ? 'Ready' : 'Loading...'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}

// For react-router lazy loading
export const Component = SqlEditorPage

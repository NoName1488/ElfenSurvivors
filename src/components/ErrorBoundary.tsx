import React from 'react';

/**
 * The last thing between a thrown error and a white window.
 *
 * React unmounts the entire tree when a component throws during render, and what the player
 * is left with is a blank screen with nothing on it - no message, no way to tell anyone what
 * happened, and a lost run. For a game that is distributed as an installer to people who
 * cannot open a developer console, that is the worst possible failure mode: it is
 * indistinguishable from the program simply dying.
 *
 * This catches it and does the three things the blank screen cannot. It says something
 * broke, it shows what, and it puts the details on the clipboard so they can be pasted into
 * a chat - which is how every bug in this project has actually been reported.
 *
 * It deliberately does not try to recover automatically. A component that threw once will
 * usually throw again on the next render, and a boundary that silently retries turns one
 * error into a loop. Reloading is the player's decision.
 */

interface Props {
  children: React.ReactNode;
  /** Optional extra context to include in the copied report, e.g. the run log. */
  collectDetails?: () => string;
}

interface State {
  error: Error | null;
  info: string;
  copied: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, info: '', copied: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // The console is still worth writing to: on the desktop build it reaches the main
    // process log, and in a browser it is what a developer will look at first.
    console.error('[boundary] a component threw', error, info);
    this.setState({ info: info.componentStack || '' });
  }

  private report(): string {
    const { error, info } = this.state;
    const extra = (() => {
      try {
        return this.props.collectDetails ? this.props.collectDetails() : '';
      } catch (e) {
        // Collecting context must never be the reason the error screen also fails.
        return '(could not collect run details)';
      }
    })();
    return [
      '=== CRASH REPORT ===',
      `when: ${new Date().toISOString()}`,
      `error: ${error ? `${error.name}: ${error.message}` : 'unknown'}`,
      '',
      'stack:',
      error?.stack || '(none)',
      '',
      'component stack:',
      info || '(none)',
      extra ? '\n' + extra : '',
    ].join('\n');
  }

  private copy = () => {
    const text = this.report();
    const done = () => {
      this.setState({ copied: true });
      window.setTimeout(() => this.setState({ copied: false }), 2500);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done).catch(() => window.prompt('Copy:', text));
    } else {
      window.prompt('Copy:', text);
    }
  };

  render() {
    if (!this.state.error) return this.props.children;

    const ru = (() => {
      try {
        return localStorage.getItem('elfen_lied_language') !== 'en';
      } catch (e) {
        return true;
      }
    })();

    return (
      <div className="fixed inset-0 bg-[#050505] flex items-center justify-center p-6 z-[100] select-text">
        <div className="max-w-xl w-full glass-panel border border-red-500/40 rounded-2xl p-6 flex flex-col gap-4 shadow-2xl">
          <div>
            <div className="text-xs font-mono uppercase tracking-[0.2em] text-red-500 font-bold">
              {ru ? 'СБОЙ' : 'CRASH'}
            </div>
            <h2 className="font-cinzel text-2xl font-black text-white mt-1">
              {ru ? 'Игра остановилась' : 'The game stopped'}
            </h2>
          </div>

          <p className="text-xs font-mono text-gray-400 leading-relaxed">
            {ru
              ? 'Что-то сломалось в интерфейсе, и продолжать нельзя. Это ошибка в игре, а не в вашем компьютере. Скопируйте отчёт и пришлите — по нему видно, что именно упало.'
              : 'Something in the interface broke and the game cannot continue. This is a bug in the game, not a problem with your computer. Copy the report and send it - it says exactly what failed.'}
          </p>

          <pre className="text-2xs font-mono text-red-300/90 bg-black/60 border border-white/10 rounded-lg p-3 overflow-auto max-h-40 whitespace-pre-wrap break-words">
            {this.state.error.name}: {this.state.error.message}
          </pre>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              onClick={this.copy}
              className="flex-1 py-2.5 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-white/15 hover:border-white/30 text-gray-200 font-mono font-bold text-xs transition-all cursor-pointer"
            >
              {this.state.copied
                ? ru ? 'ОТЧЁТ СКОПИРОВАН' : 'REPORT COPIED'
                : ru ? 'СКОПИРОВАТЬ ОТЧЁТ' : 'COPY REPORT'}
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 border border-red-400 text-white font-cinzel font-bold text-xs transition-all cursor-pointer shadow-[0_0_15px_rgba(220,38,38,0.35)]"
            >
              {ru ? 'ПЕРЕЗАПУСТИТЬ' : 'RESTART'}
            </button>
          </div>
        </div>
      </div>
    );
  }
}

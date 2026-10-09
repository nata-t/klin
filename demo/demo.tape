# The ~60 second README GIF. Record with https://github.com/charmbracelet/vhs:
#   pnpm build && vhs demo/demo.tape
# Uses the local build through an alias so it works before publishing.

Output demo/demo.gif

Set Shell "bash"
Set FontSize 15
Set Width 1180
Set Height 760
Set Padding 28
Set Theme "Catppuccin Mocha"
Set TypingSpeed 45ms
Set CursorBlink false

Hide
Type "alias create-klin='node packages/create-klin/dist/index.js' && cd $(mktemp -d) && clear"
Enter
Show

Type "npm create klin@latest my-saas"
Sleep 400ms
Hide
# Swap the published command for the local build while recording.
Ctrl+U
Type "create-klin my-saas"
Show
Enter
Sleep 2.2s

# Preset: SaaS starter
Down
Sleep 500ms
Enter
Sleep 900ms

# Vibe: emerald
Down
Sleep 300ms
Down
Sleep 400ms
Enter
Sleep 900ms

# Package manager: keep pnpm
Enter
Sleep 2.4s

# "Looks spotless?"
Enter
Sleep 22s

Type "cd my-saas && pnpm klin generate resource project name:string 'budget:int?' 'due:date?' --yes"
Enter
Sleep 7s

Type "pnpm klin doctor"
Enter
Sleep 6s

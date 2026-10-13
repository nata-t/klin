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
Sleep 2.4s

# 1 Base: the name came from the command line — start from the SaaS preset
Down
Sleep 300ms
Down
Sleep 400ms
Left
Left
Left
Right
Sleep 300ms
Space
Sleep 1.2s
Enter
Sleep 1.4s

# 2 Stack: NestJS on Fastify
Down
Sleep 300ms
Left
Right
Sleep 300ms
Space
Sleep 1.2s
Enter
Sleep 1.2s

# 3 Auth, 4 Toolbox: keep the preset's picks
Enter
Sleep 1.2s
Enter
Sleep 1.4s

# 5 Looks: emerald
Down
Sleep 300ms
Left
Left
Left
Right
Right
Right
Right
Sleep 300ms
Space
Sleep 1.2s
Enter
Sleep 1.6s

# 6 Build
Enter
Sleep 24s

Type "cd my-saas && pnpm klin generate resource project name:string 'budget:int?' 'due:date?' --yes"
Enter
Sleep 7s

Type "pnpm klin doctor"
Enter
Sleep 6s

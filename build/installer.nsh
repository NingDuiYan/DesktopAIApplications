; =============================================
; 自定义 NSIS 脚本：安装向导视觉美化 + 快捷方式选项页
; 1. 深色现代主题：欢迎/完成页深蓝底 + 白字，与默认浅灰界面区分
; 2. 快捷方式设置页：两个复选框（桌面/开始菜单），默认勾选
; 3. 完成页"运行"复选框白字修正（深色背景下默认黑字不可见）
; =============================================
; MUI2/nsDialogs 需在 installer.nsi 主模板加载之前引入
!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"

; ---------------------------------------------
; 主题定义（必须在第一个 MUI 页面宏展开之前生效）
; ---------------------------------------------
; 品牌色：深海军蓝底 + 白字（现代深色欢迎页效果）
!define MUI_BGCOLOR "161C2D"
!define MUI_TEXTCOLOR "FFFFFF"
; 所有页面左下角的品牌文字
!define MUI_BRANDINGTEXT "桌面应用"
; 取消安装时的确认提示
!define MUI_ABORTWARNING
!define MUI_ABORTWARNING_TEXT "确定要取消安装 桌面应用 吗？"

; 页面变量必须在文件作用域声明（installer 与 uninstaller 两遍编译都要能解析）
; 卸载器编译时这些变量未被引用，抑制 NSIS 6001 警告
!pragma warning disable 6001
Var /GLOBAL shortcutPage.Dialog
Var /GLOBAL shortcutPage.DesktopCheckbox
Var /GLOBAL shortcutPage.StartMenuCheckbox
Var /GLOBAL createDesktopShortcutChoice
Var /GLOBAL createStartMenuShortcutChoice
!pragma warning enable 6001

; ---------------------------------------------
; 初始化默认值：即使页面未显示（静默安装/自动更新），也保持"创建快捷方式"默认行为
; ---------------------------------------------
!macro customInit
  StrCpy $createDesktopShortcutChoice ${BST_CHECKED}
  StrCpy $createStartMenuShortcutChoice ${BST_CHECKED}
!macroend

; ---------------------------------------------
; 完成页：覆盖 electron-builder 默认版本
; - 保留默认行为（运行复选框 + StartApp）
; - 附加 SHOW 回调：深色背景上强制"运行"复选框白字
;   先禁用视觉样式（SetWindowTheme 空主题）再设颜色，
;   否则 uxtheme 主题引擎会忽略 SetCtlColors 设置的颜色
; ---------------------------------------------
!macro customFinishPage
  !ifndef HIDE_RUN_AFTER_FINISH
    Function StartApp
      ${if} ${isUpdated}
        StrCpy $1 "--updated"
      ${else}
        StrCpy $1 ""
      ${endif}
      ; 防御：$launchLink 若不存在（开始菜单快捷方式被删），改用安装目录下的 exe
      ${IfNot} ${FileExists} "$launchLink"
        StrCpy $launchLink "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
      ${EndIf}
      ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
    FunctionEnd

    !define MUI_FINISHPAGE_RUN
    !define MUI_FINISHPAGE_RUN_FUNCTION "StartApp"
  !endif

  !define MUI_PAGE_CUSTOMFUNCTION_SHOW finishPageShow
  !insertmacro MUI_PAGE_FINISH

  ; 注意：函数必须定义在 MUI_PAGE_FINISH 之后，
  ; 因为 Var mui.FinishPage.Run 由该页面宏展开时声明，
  ; NSIS 单遍编译，函数体在前会导致 unknown variable 报错
  Function finishPageShow
    ${If} $mui.FinishPage.Run != 0
      System::Call 'uxtheme::SetWindowTheme(p $mui.FinishPage.Run, w " ", w " ")'
      SetCtlColors $mui.FinishPage.Run "FFFFFF" "161C2D"
    ${EndIf}
  FunctionEnd
!macroend

; ---------------------------------------------
; 快捷方式设置页（在选择安装目录之后插入）
; ---------------------------------------------
!macro customPageAfterChangeDir
  !ifndef BUILD_UNINSTALLER
    Function shortcutPageCreate
      !insertmacro MUI_HEADER_TEXT "快捷方式设置" "选择要创建的快捷方式"
      nsDialogs::Create 1018
      Pop $shortcutPage.Dialog
      ${If} $shortcutPage.Dialog == error
        Abort
      ${EndIf}

      ; 说明文案（稍大的字体）
      ${NSD_CreateLabel} 0 0 100% 20u "请选择安装过程中需要创建的快捷方式："
      Pop $0
      CreateFont $1 "Microsoft YaHei UI" 10
      SendMessage $0 ${WM_SETFONT} $1 1

      ; 分组框让选项更清晰
      ${NSD_CreateGroupBox} 8u 26u 100% 52u "快捷方式选项"
      Pop $0
      CreateFont $4 "Microsoft YaHei UI" 9
      SendMessage $0 ${WM_SETFONT} $4 1

      ; 桌面快捷方式（默认勾选）
      ${NSD_CreateCheckbox} 22u 42u 90% 14u "创建桌面快捷方式(&D)"
      Pop $shortcutPage.DesktopCheckbox
      CreateFont $2 "Microsoft YaHei UI" 9
      SendMessage $shortcutPage.DesktopCheckbox ${WM_SETFONT} $2 1
      ${NSD_Check} $shortcutPage.DesktopCheckbox

      ; 开始菜单快捷方式（默认勾选）
      ${NSD_CreateCheckbox} 22u 60u 90% 14u "创建开始菜单快捷方式(&S)"
      Pop $shortcutPage.StartMenuCheckbox
      SendMessage $shortcutPage.StartMenuCheckbox ${WM_SETFONT} $2 1
      ${NSD_Check} $shortcutPage.StartMenuCheckbox

      nsDialogs::Show
    FunctionEnd

    Function shortcutPageLeave
      ; 记录用户选择，供 customInstall 判断是否删除对应快捷方式
      ${NSD_GetState} $shortcutPage.DesktopCheckbox $createDesktopShortcutChoice
      ${NSD_GetState} $shortcutPage.StartMenuCheckbox $createStartMenuShortcutChoice
    FunctionEnd

    Page custom shortcutPageCreate shortcutPageLeave
  !endif
!macroend

; ---------------------------------------------
; 按用户选择删除快捷方式（electron-builder 已默认创建，这里在创建之后删除）
; ---------------------------------------------
!macro customInstall
  ${If} $createDesktopShortcutChoice != ${BST_CHECKED}
    Delete "$DESKTOP\${SHORTCUT_NAME}.lnk"
    DetailPrint "已跳过桌面快捷方式（用户未勾选）"
  ${EndIf}
  ${If} $createStartMenuShortcutChoice != ${BST_CHECKED}
    !ifdef MENU_FILENAME
      Delete "$SMPROGRAMS\${MENU_FILENAME}\${SHORTCUT_NAME}.lnk"
      RMDir "$SMPROGRAMS\${MENU_FILENAME}"
    !else
      Delete "$SMPROGRAMS\${SHORTCUT_NAME}.lnk"
    !endif
    ; 完成页"运行"依赖 $launchLink（原指向开始菜单 lnk），改为指向 exe
    StrCpy $launchLink "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
    DetailPrint "已跳过开始菜单快捷方式（用户未勾选）"
  ${EndIf}
!macroend
**novel_preview.vim**

https://user-images.githubusercontent.com/30687489/137055106-c59e20e6-75df-4660-8335-59358e75cda2.mp4

# 概要

Vimの現在のバッファの中身をブラウザに縦書き1行40文字でプレビューします。

[ttrace](https://github.com/ttrace)氏の[vscode日本語縦書き小説拡張](https://github.com/ttrace/vscode-language-japanese-novel/tree/master/src)に触発されて作りました。これのプレビュー機能だけを取り出したVim版だと思ってくれればだいたい合ってます。
実装においても大いに参考にしました。感謝します。

小説を縦書きでそれっぽくプレビューできるものが欲しかったのでdenopsでさくっと作りました。個人的な使用を目的として作られているので機能は超限定的ですし、正しく動くかはわかりません。
その分ソースコードも超単純（なはず）なので、わからないことがあったら読んでください。欲しい機能は言ってくれたら作るかもしれません。

# requirements

denoと[denops.vim](https://github.com/vim-denops/denops.vim)

# つかいかた

`NovelPreviewStartServer`でlocalhost:8899に縦書きプレビューサーバーを起動します。
`NovelPreviewSend`でサーバーに現在のバッファの内容とカーソルの位置を送信します。

例えば、
```
autocmd BufWrite,CursorMoved,TextChangedI <buffer> NovelPreviewSend
```
とすれば、文章を書き進めるたびにサーバーが更新されます。なお、`NovelPreviewAutoSend`はこれを行います。

また例えば、小説を`*.novel`という拡張子で保存するようにしている場合、
```
augroup novelPreview
    autocmd!
    autocmd BufWrite,CursorMoved,TextChangedI *.novel NovelPreviewSend
augroup END
```
とすれば、この拡張子のときは常にSendしてくれるようになります。

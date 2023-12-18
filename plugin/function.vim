command! NovelPreviewAutoSend autocmd BufWrite,CursorMoved,TextChangedI,TextChanged <buffer> NovelPreviewSend

let g:novelpreview#charperline=get(g:,'novelpreview#charperline',40)
let g:novelpreview#height=get(g:,'novelpreview#height',100)

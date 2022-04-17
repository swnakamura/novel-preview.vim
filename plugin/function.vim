let s:distance_cache = 'not ready yet'

function! NovelPreviewEditDistance()
    return s:distance_cache
endfunction

function! UpdateEditDistance()
    try
        let s:distance_cache = denops#request('novel_preview', 'editDistance', [])
    catch /.*/
        let s:distance_cache = 'not ready yet'
    endtry
endfunction

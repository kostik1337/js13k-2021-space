const mapping: {[key: string]: any} = {}

declare var DEBUG_DATA: boolean;

let updateDebugDiv = () => {
    let str = ""
    Object.entries(mapping).forEach(([key, val])=> {
        str += `<br/>${key}: ${val}`
    })
    document.getElementById("debug_div").innerHTML = str
}

export const debugLog = (key: string, text: any) => {
    if (!DEBUG_DATA) return
    mapping[key] = text
    updateDebugDiv()
}
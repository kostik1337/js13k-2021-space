const mapping: {[key: string]: any} = {}

let updateDebugDiv = () => {
    let str = ""
    Object.entries(mapping).forEach(([key, val])=> {
        str += `<br/>${key}: ${val}`
    })
    document.getElementById("debug_div").innerHTML = str
}

export const debugLog = (key: string, text: any) => {
    mapping[key] = text
    updateDebugDiv()
}
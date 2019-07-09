struct InitData : Codable {
    let receivers: [Receiver]
    let defaultMediaType: MediaType
    let availableMediaTypes: Int

    let i18n_extensionName: String
    let i18n_castButtonTitle: String
    let i18n_mediaTypeApp: String
    let i18n_mediaTypeTab: String
    let i18n_mediaTypeScreen: String
    let i18n_mediaSelectCastLabel: String
    let i18n_mediaSelectToLabel: String
}

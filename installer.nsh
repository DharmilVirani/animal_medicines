!macro customInstall
  SetOutPath "$INSTDIR" 
  CreateShortCut "$INSTDIR\\MedicineApp.lnk" "$INSTDIR\\MedicineApp.exe" 
!macroend

!macro customUnInstall
  Delete "$INSTDIR\\MedicineApp.lnk" 
!macroend
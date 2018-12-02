Name: fx_cast_bridge
Summary: fx_cast Bridge application
Version: 0.0.1
Release: 1
License: MIT

%description
fx_cast Bridge application

%install
rm -rf $RPM_BUILD_ROOT
mkdir -p $RPM_BUILD_ROOT/opt/fx_cast/ \
         $RPM_BUILD_ROOT/usr/lib/mozilla/native-messaging-hosts/

cp %{_distdir}/bridge $RPM_BUILD_ROOT/opt/fx_cast/
cp %{_distdir}/fx_cast_bridge.json $RPM_BUILD_ROOT/usr/lib/mozilla/native-messaging-hosts/

%files
/opt/fx_cast/bridge
/usr/lib/mozilla/native-messaging-hosts/fx_cast_bridge.json

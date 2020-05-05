Name: {{packageName}}
Summary: {{applicationName}}
Version: {{applicationVersion}}
Release: 1
License: MIT
Requires: avahi, avahi-compat-libdns_sd

%description
{{applicationName}}

%install
rm -rf $RPM_BUILD_ROOT
mkdir -p $RPM_BUILD_ROOT/{{{executablePath}}} \
         $RPM_BUILD_ROOT/{{{manifestPath}}}

cp %{_distdir}/{{{executableName}}} $RPM_BUILD_ROOT/{{{executablePath}}}
cp ${_distdir}/{{{bindingName}}} $RPM_BUILD_ROOT/{{{executablePath}}}
cp %{_distdir}/{{{manifestName}}} $RPM_BUILD_ROOT/{{{manifestPath}}}

%files
{{{executablePath}}}/{{{executableName}}}
{{{manifestPath}}}/{{{manifestName}}}

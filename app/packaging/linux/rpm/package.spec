%global __os_install_post %{nil}
%define _source_payload w7.lzdio
%define _binary_payload w7.lzdio

Name: {{packageName}}
Summary: {{applicationName}}
Version: {{applicationVersion}}
Release: 1
License: MIT
Requires: avahi, avahi-compat-libdns_sd, nss-mdns

%description
{{applicationName}}

%install
rm -rf $RPM_BUILD_ROOT
mkdir -p $RPM_BUILD_ROOT/{{{executablePath}}} \
         $RPM_BUILD_ROOT/{{{manifestPath}}}

cp %{_distdir}/{{{executableName}}} $RPM_BUILD_ROOT/{{{executablePath}}}
cp %{_distdir}/{{{bindingName}}} $RPM_BUILD_ROOT/{{{executablePath}}}
cp %{_distdir}/{{{manifestName}}} $RPM_BUILD_ROOT/{{{manifestPath}}}

%files
{{{executablePath}}}/{{{executableName}}}
{{{executablePath}}}/{{{bindingName}}}
{{{manifestPath}}}/{{{manifestName}}}

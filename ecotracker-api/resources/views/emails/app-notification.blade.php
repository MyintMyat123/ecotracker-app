<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $notification->title }}</title>
</head>
<body style="margin:0;background:#020617;color:#e5eefb;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#020617;padding:28px 14px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#0f172a;border:1px solid #1e2b44;border-radius:18px;overflow:hidden;">
                    <tr>
                        <td style="height:5px;background:#14e6c3;"></td>
                    </tr>
                    <tr>
                        <td style="padding:28px;">
                            <p style="margin:0 0 18px;color:#14e6c3;font-size:12px;font-weight:700;letter-spacing:4px;text-transform:uppercase;">
                                EcoTracker
                            </p>
                            <h1 style="margin:0 0 12px;color:#ffffff;font-size:26px;line-height:1.2;">
                                {{ $notification->title }}
                            </h1>
                            <p style="margin:0 0 22px;color:#cbd5e1;font-size:15px;line-height:1.65;">
                                {!! nl2br(e(str_replace(['**'], '', $notification->message))) !!}
                            </p>

                            @if(!empty($notification->data['species_name']))
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 22px;background:#08111f;border:1px solid #22304a;border-radius:14px;">
                                    <tr>
                                        <td style="padding:16px;">
                                            <p style="margin:0 0 6px;color:#8da2c0;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Species</p>
                                            <p style="margin:0;color:#ffffff;font-size:18px;font-weight:700;">{{ $notification->data['species_name'] }}</p>
                                            @if(!empty($notification->data['scientific_name']))
                                                <p style="margin:5px 0 0;color:#94a3b8;font-size:13px;font-style:italic;">{{ $notification->data['scientific_name'] }}</p>
                                            @endif
                                        </td>
                                    </tr>
                                </table>
                            @endif

                            @if(!empty($notification->data['attached_species']) && is_array($notification->data['attached_species']))
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 22px;background:#08111f;border:1px solid #22304a;border-radius:14px;">
                                    <tr>
                                        <td style="padding:16px;">
                                            <p style="margin:0 0 10px;color:#8da2c0;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Attached species</p>
                                            @foreach($notification->data['attached_species'] as $species)
                                                <p style="margin:0 0 8px;color:#ffffff;font-size:14px;font-weight:700;">
                                                    {{ $species['species_name'] ?? $species['common_name'] ?? $species['scientific_name'] ?? 'Species' }}
                                                    @if(!empty($species['conservation_status']))
                                                        <span style="color:#fbbf24;">({{ $species['conservation_status'] }})</span>
                                                    @endif
                                                </p>
                                                @if(!empty($species['scientific_name']))
                                                    <p style="margin:-4px 0 10px;color:#94a3b8;font-size:12px;font-style:italic;">{{ $species['scientific_name'] }}</p>
                                                @endif
                                            @endforeach
                                        </td>
                                    </tr>
                                </table>
                            @endif

                            @if(!empty($notification->data['change_summary']) && is_array($notification->data['change_summary']))
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 22px;background:#071827;border:1px solid #164e63;border-radius:14px;">
                                    <tr>
                                        <td style="padding:16px;">
                                            <p style="margin:0 0 10px;color:#67e8f9;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:700;">What changed</p>
                                            @foreach($notification->data['change_summary'] as $line)
                                                <p style="margin:0 0 7px;color:#dbeafe;font-size:14px;line-height:1.5;">{{ $line }}</p>
                                            @endforeach
                                        </td>
                                    </tr>
                                </table>
                            @endif

                            <a href="{{ $actionUrl }}" style="display:inline-block;background:#14e6c3;color:#031116;text-decoration:none;font-weight:700;border-radius:999px;padding:12px 18px;font-size:13px;letter-spacing:1px;text-transform:uppercase;">
                                View in EcoTracker
                            </a>

                            <p style="margin:24px 0 0;color:#64748b;font-size:12px;line-height:1.5;">
                                You are receiving this email because EcoTracker created a notification for your account.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
